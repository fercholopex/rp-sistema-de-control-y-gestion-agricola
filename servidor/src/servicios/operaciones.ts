import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  calcularCostoManoObra,
  calcularCostoOperacion,
  calcularCostoProducto,
  calcularCostoRiego,
} from "../../../lib/servicios/motor-costos";
import { consultar, type Conexion, type Fila } from "../base_datos/conexion";
import { ErrorSolicitud } from "../utilidades/errores";
import {
  esquemaAplicacionProducto,
  esquemaManoObra,
  esquemaRiego,
  normalizarFecha,
} from "../utilidades/validacion";
import { exigirRelacionado, insertar } from "./registros";

type ManoObra = z.infer<typeof esquemaManoObra>;
type AplicacionProducto = z.infer<typeof esquemaAplicacionProducto>;
type Riego = z.infer<typeof esquemaRiego>;

export async function prepararOperacion(
  conexion: Conexion,
  datos: Fila,
  anterior?: Fila,
) {
  const valores: Fila = { ...datos };
  delete valores.mano_obra;
  delete valores.productos;
  delete valores.riego;
  const manoObra: Fila[] = [];
  const productos: Fila[] = [];
  let riego: Fila | null = null;
  let costoManoObra = Number(anterior?.costo_mano_obra ?? 0);
  let costoProductos = Number(anterior?.costo_productos ?? 0);
  let costoRiego = Number(anterior?.costo_riego ?? 0);
  if (datos.mano_obra !== undefined) {
    const historicos = anterior
      ? await consultar(
          "SELECT * FROM detalles_mano_obra WHERE operacion_id=?",
          [anterior.id],
          conexion,
        )
      : [];
    const porEmpleado = new Map(
      historicos.map((fila) => [String(fila.empleado_id), fila]),
    );
    const entradas = datos.mano_obra as ManoObra[];
    if (
      new Set(entradas.map((entrada) => entrada.empleado_id)).size !==
      entradas.length
    )
      throw new ErrorSolicitud(
        400,
        "Cada empleado debe aparecer una sola vez en la operación.",
      );
    for (const entrada of entradas) {
      const historico = porEmpleado.get(entrada.empleado_id);
      // Una partida existente conserva su nombre, tipo de pago y tarifa capturados aunque cambie el catálogo.
      const empleado = historico
        ? {
            id: historico.empleado_id,
            nombre_completo: historico.nombre_empleado,
            tipo_pago: historico.tipo_pago,
            tarifa_actual: historico.tarifa_capturada,
          }
        : await exigirRelacionado(
            conexion,
            "empleados",
            entrada.empleado_id,
            "El empleado seleccionado no existe o está inactivo.",
          );
      manoObra.push({
        empleado_id: empleado.id,
        nombre_empleado: empleado.nombre_completo,
        tipo_pago: empleado.tipo_pago,
        tarifa_capturada:
          entrada.tarifa_capturada ?? Number(empleado.tarifa_actual),
        cantidad: entrada.cantidad,
        porcentaje_asignacion:
          entrada.porcentaje_asignacion === undefined
            ? (historico?.porcentaje_asignacion ?? null)
            : entrada.porcentaje_asignacion,
      });
    }
    try {
      const calculo = calcularCostoManoObra(
        manoObra.map((entrada) => ({
          empleado_id: String(entrada.empleado_id),
          nombre_empleado: String(entrada.nombre_empleado),
          tarifa_capturada: Number(entrada.tarifa_capturada),
          cantidad: Number(entrada.cantidad),
          porcentaje_asignacion:
            entrada.porcentaje_asignacion === null
              ? undefined
              : Number(entrada.porcentaje_asignacion),
        })),
      );
      calculo.partidas.forEach((partida, indice) => {
        manoObra[indice].costo_individual = partida.costo_individual;
      });
      costoManoObra = calculo.total;
    } catch (error) {
      throw new ErrorSolicitud(
        400,
        error instanceof Error
          ? error.message
          : "No se pudo calcular la mano de obra.",
      );
    }
  }
  if (datos.productos !== undefined) {
    const historicos = anterior
      ? await consultar(
          "SELECT * FROM aplicaciones_productos WHERE operacion_id=?",
          [anterior.id],
          conexion,
        )
      : [];
    const porProducto = new Map(
      historicos.map((fila) => [String(fila.producto_id), fila]),
    );
    const entradas = datos.productos as AplicacionProducto[];
    if (
      new Set(entradas.map((entrada) => entrada.producto_id)).size !==
      entradas.length
    )
      throw new ErrorSolicitud(
        400,
        "Cada producto debe aparecer una sola vez en la operación.",
      );
    for (const entrada of entradas) {
      const historico = porProducto.get(entrada.producto_id);
      const producto = historico
        ? {
            id: historico.producto_id,
            nombre: historico.nombre_producto,
            unidad_base: historico.unidad,
            precio_actual: historico.precio_unitario,
          }
        : await exigirRelacionado(
            conexion,
            "productos",
            entrada.producto_id,
            "El producto seleccionado no existe o está inactivo.",
            "activo=1",
          );
      const precio = entrada.precio_unitario ?? producto.precio_actual;
      if (precio == null)
        throw new ErrorSolicitud(
          400,
          "El producto no tiene precio. Registra un precio o una cotización para esta operación.",
        );
      const costo = calcularCostoProducto({
        cantidad: entrada.cantidad,
        precio_unitario: Number(precio),
      });
      productos.push({
        producto_id: producto.id,
        nombre_producto: producto.nombre,
        cantidad: entrada.cantidad,
        unidad: producto.unidad_base,
        precio_unitario: Number(precio),
        costo_producto: costo,
      });
    }
    costoProductos =
      Math.round(
        productos.reduce(
          (total, entrada) => total + Number(entrada.costo_producto),
          0,
        ) * 100,
      ) / 100;
  }
  if (datos.riego !== undefined) {
    costoRiego = 0;
    if (datos.riego) {
      if (datos.tipo_operacion !== "riego")
        throw new ErrorSolicitud(
          400,
          "Los detalles de riego solo pueden registrarse en una operación de riego.",
        );
      const entrada = datos.riego as Riego;
      try {
        const calculo = calcularCostoRiego({
          ...entrada,
          inicio: normalizarFecha(entrada.inicio),
          fin: normalizarFecha(entrada.fin),
          costo_valvula: entrada.costo_valvulas,
        });
        costoRiego = calculo.total;
        riego = {
          ...entrada,
          duracion_horas: calculo.duracion_horas,
          costo_tarifa: calculo.costo_tarifa,
        };
      } catch (error) {
        throw new ErrorSolicitud(
          400,
          error instanceof Error
            ? error.message
            : "El intervalo de riego no es válido.",
        );
      }
    }
  } else if (
    anterior?.tipo_operacion === "riego" &&
    datos.tipo_operacion !== "riego"
  ) {
    const existentes = await consultar(
      "SELECT id FROM detalles_riego WHERE operacion_id=?",
      [anterior.id],
      conexion,
    );
    if (existentes.length)
      throw new ErrorSolicitud(
        409,
        "Para cambiar el tipo de operación debes retirar explícitamente sus detalles de riego.",
      );
  }
  valores.costo_mano_obra = costoManoObra;
  valores.costo_productos = costoProductos;
  valores.costo_riego = costoRiego;
  const costoTotal = calcularCostoOperacion({
    costo_mano_obra: costoManoObra,
    costo_productos: costoProductos,
    costo_riego: costoRiego,
    costo_aplicacion: Number(datos.costo_aplicacion),
    otros_costos: Number(datos.otros_costos),
  });
  if (costoTotal > 9999999999.99)
    throw new ErrorSolicitud(
      400,
      "El costo de la operación excede el importe permitido.",
    );
  valores.costo_total = costoTotal;
  return {
    valores,
    manoObra,
    productos,
    riego,
    reemplazarManoObra: datos.mano_obra !== undefined,
    reemplazarProductos: datos.productos !== undefined,
    reemplazarRiego: datos.riego !== undefined,
  };
}

export async function guardarDetalles(
  conexion: Conexion,
  id: string,
  preparado: Awaited<ReturnType<typeof prepararOperacion>>,
) {
  if (preparado.reemplazarManoObra) {
    await conexion.query(
      "DELETE FROM detalles_mano_obra WHERE operacion_id=?",
      [id],
    );
    for (const entrada of preparado.manoObra)
      await insertar(conexion, "detalles_mano_obra", {
        id: randomUUID(),
        operacion_id: id,
        ...entrada,
      });
  }
  if (preparado.reemplazarProductos) {
    await conexion.query(
      "DELETE FROM aplicaciones_productos WHERE operacion_id=?",
      [id],
    );
    for (const entrada of preparado.productos)
      await insertar(conexion, "aplicaciones_productos", {
        id: randomUUID(),
        operacion_id: id,
        ...entrada,
      });
  }
  if (preparado.reemplazarRiego) {
    await conexion.query("DELETE FROM detalles_riego WHERE operacion_id=?", [
      id,
    ]);
    if (preparado.riego)
      await insertar(conexion, "detalles_riego", {
        id: randomUUID(),
        operacion_id: id,
        ...preparado.riego,
      });
  }
}
