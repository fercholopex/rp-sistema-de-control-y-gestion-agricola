"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import {
  type Campo,
  type Modulo,
  type Opcion,
} from "@/cliente/src/configuracion/modulos";
import {
  ErrorSolicitud,
  fechaCapturadaAISO,
  fechaFormulario,
  mensajeError,
  obtenerOpciones,
  solicitar,
  type Registro,
} from "@/cliente/src/servicios/http";
import { Aviso, Cargando } from "@/components/elementos";
import {
  DetalleCostosOperacion,
  type ComponentesOperacion,
} from "@/components/costos-operacion";

const factorSuperficie = (unidad: unknown) =>
  unidad === "metro_cuadrado" ? 0.0001 : unidad === "acre" ? 0.40468564224 : 1;
type ErrorCampo = { campo: string; mensaje: string };
const etiquetasCostos: Record<string, string> = {
  mano_obra: "Mano de obra",
  productos: "Productos aplicados",
  riego: "Riego",
  empleado_id: "Empleado",
  producto_id: "Producto",
  cantidad: "Cantidad",
  porcentaje_asignacion: "Porcentaje de asignación",
  tarifa_capturada: "Tarifa del empleado",
  precio_unitario: "Precio unitario",
  inicio: "Inicio",
  fin: "Fin",
  tarifa_hora: "Tarifa por hora",
  costo_agua: "Costo de agua",
  costo_valvulas: "Costo de válvulas",
  costo_operador: "Costo de operador",
  otros_costos: "Otros costos",
};
function nombreCampoError(ruta: string, modulo: Modulo) {
  return ruta
    ? ruta
        .split(".")
        .map((parte) =>
          /^\d+$/.test(parte)
            ? "Fila " + (Number(parte) + 1)
            : (modulo.campos.find((campo) => campo.nombre === parte)
                ?.etiqueta ??
              etiquetasCostos[parte] ??
              parte.replaceAll("_", " ")),
        )
        .join(" · ")
    : "Formulario";
}
function compararPartidas(
  partidas: unknown[],
  textos: string[],
  numeros: string[],
) {
  return JSON.stringify(
    partidas.map((valor) => {
      const partida = valor as Record<string, unknown>;
      return [
        ...textos.map((clave) => String(partida[clave] ?? "")),
        ...numeros.map((clave) =>
          partida[clave] == null ? null : Number(partida[clave]),
        ),
      ];
    }),
  );
}

export function EntradaCampo({
  campo,
  valor,
  cambiar,
  opciones,
  requerido,
  error,
}: {
  campo: Campo;
  valor: unknown;
  cambiar: (valor: string) => void;
  opciones?: Opcion[];
  requerido?: boolean;
  error?: string;
}) {
  const propiedades = {
    name: campo.nombre,
    value: String(valor ?? ""),
    onChange: (
      evento: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => cambiar(evento.target.value),
    required: requerido ?? campo.requerido,
    className: "campo",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? "error-" + campo.nombre : undefined,
  };
  return (
    <label
      className={
        "etiqueta " +
        (campo.tipo === "textarea" || campo.tipo === "json"
          ? "campo-ancho"
          : "")
      }
    >
      <span>
        {campo.etiqueta}
        {propiedades.required && <span className="obligatorio"> *</span>}
      </span>
      {campo.tipo === "textarea" || campo.tipo === "json" ? (
        <textarea {...propiedades} rows={3} maxLength={10000} />
      ) : campo.tipo === "select" ? (
        <select {...propiedades}>
          <option value="">
            {propiedades.required ? "Seleccionar..." : "Sin seleccionar"}
          </option>
          {(opciones ?? campo.opciones)?.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...propiedades}
          type={campo.tipo ?? "text"}
          min={campo.minimo}
          max={campo.maximo}
          step={campo.tipo === "number" ? "any" : undefined}
          minLength={campo.tipo === "password" ? 12 : undefined}
          maxLength={
            campo.tipo === "password"
              ? 128
              : campo.tipo === "email"
                ? 191
                : 2000
          }
          autoComplete={campo.tipo === "password" ? "new-password" : undefined}
        />
      )}
      {campo.ayuda && <small>{campo.ayuda}</small>}
      {error && (
        <small id={"error-" + campo.nombre} className="texto-peligro">
          {error}
        </small>
      )}
    </label>
  );
}

export function FormularioRegistro({
  modulo,
  registro,
  completar,
  cancelar,
}: {
  modulo: Modulo;
  registro: Registro | null;
  completar: () => void;
  cancelar: () => void;
}) {
  const [valores, asignarValores] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      modulo.campos.map((campo) => {
        let valor = registro?.[campo.nombre] ?? campo.inicial ?? "";
        if (campo.tipo === "date" || campo.tipo === "datetime-local")
          valor = fechaFormulario(valor, campo.tipo === "datetime-local");
        if (
          campo.tipo === "json" &&
          typeof valor === "object" &&
          valor !== null
        )
          valor = JSON.stringify(valor, null, 2);
        if (campo.nombre === "superficie_ha" && registro)
          valor =
            Number(registro.superficie_ha) /
            factorSuperficie(registro.unidad_superficie);
        if (campo.nombre === "activo")
          valor =
            valor === true || valor === 1 || valor === "true"
              ? "true"
              : "false";
        return [campo.nombre, valor];
      }),
    ),
  );
  const [opciones, asignarOpciones] = useState<Record<string, Opcion[]>>({});
  const [cargando, asignarCargando] = useState(true);
  const [guardando, asignarGuardando] = useState(false);
  const [error, asignarError] = useState("");
  const [erroresCampos, asignarErroresCampos] = useState<ErrorCampo[]>([]);
  const resumenErrores = useRef<HTMLDivElement>(null);
  const [componentes, asignarComponentes] = useState<ComponentesOperacion>(
    () => {
      const riego = (registro?.riego as ComponentesOperacion["riego"]) ?? null;
      return {
        mano_obra: Array.isArray(registro?.mano_obra)
          ? (registro.mano_obra as ComponentesOperacion["mano_obra"])
          : [],
        productos: Array.isArray(registro?.productos)
          ? (registro.productos as ComponentesOperacion["productos"])
          : [],
        riego: riego
          ? {
              ...riego,
              inicio: fechaFormulario(riego.inicio, true),
              fin: fechaFormulario(riego.fin, true),
            }
          : null,
      };
    },
  );
  const [componentesIniciales] = useState(componentes);
  useEffect(() => {
    let vigente = true;
    Promise.all(
      modulo.campos
        .filter((campo) => campo.origen)
        .map(async (campo) => {
          const registros = await obtenerOpciones(campo.origen!);
          const opcionesCampo = registros
            .filter(
              (fila) =>
                campo.nombre !== "lote_padre_id" || fila.id !== registro?.id,
            )
            .map((fila) => ({
              valor: fila.id,
              etiqueta: String(
                fila[campo.etiquetaOrigen ?? "nombre"] ?? fila.id,
              ),
            }));
          const actual = registro?.[campo.nombre];
          if (
            actual &&
            !opcionesCampo.some((opcion) => opcion.valor === String(actual))
          )
            opcionesCampo.push({
              valor: String(actual),
              etiqueta: String(
                registro?.["nombre_" + campo.nombre.replace("_id", "")] ??
                  "Registro histórico seleccionado",
              ),
            });
          return [campo.nombre, opcionesCampo] as const;
        }),
    )
      .then((resultado) => {
        if (vigente) asignarOpciones(Object.fromEntries(resultado));
      })
      .catch((fallo) => {
        if (vigente) asignarError(mensajeError(fallo));
      })
      .finally(() => {
        if (vigente) asignarCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [modulo, registro]);
  useEffect(() => {
    if (error) resumenErrores.current?.focus();
  }, [error, erroresCampos]);
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datosFormulario = new FormData(evento.currentTarget);
    asignarGuardando(true);
    asignarError("");
    asignarErroresCampos([]);
    try {
      const cuerpo: Record<string, unknown> = {};
      for (const campo of modulo.campos) {
        const valor = datosFormulario.has(campo.nombre)
          ? datosFormulario.get(campo.nombre)
          : valores[campo.nombre];
        if (campo.tipo === "password" && !valor && registro) continue;
        if (campo.tipo === "json" && valor) {
          try {
            cuerpo[campo.nombre] = JSON.parse(String(valor));
          } catch {
            throw new Error(
              "El contenido de " +
                campo.etiqueta.toLowerCase() +
                " no tiene un formato válido.",
            );
          }
        } else
          cuerpo[campo.nombre] =
            campo.nombre === "activo"
              ? valor === "true"
              : valor === ""
                ? null
                : campo.tipo === "number"
                  ? Number(valor)
                  : campo.tipo === "datetime-local"
                    ? fechaCapturadaAISO(String(valor))
                    : valor;
      }
      if (
        modulo.recurso === "lotes" &&
        (cuerpo.latitud == null) !== (cuerpo.longitud == null)
      )
        throw new Error("La latitud y longitud deben capturarse juntas.");
      if (modulo.recurso === "lotes")
        cuerpo.superficie_ha =
          Number(cuerpo.superficie_ha) *
          factorSuperficie(cuerpo.unidad_superficie);
      if (modulo.recurso === "operaciones") {
        const mano_obra = componentes.mano_obra.map(
          ({
            empleado_id,
            cantidad,
            porcentaje_asignacion,
            tarifa_capturada,
          }) => ({
            empleado_id,
            cantidad: Number(cantidad),
            ...(porcentaje_asignacion != null
              ? { porcentaje_asignacion: Number(porcentaje_asignacion) }
              : {}),
            ...(tarifa_capturada !== undefined
              ? { tarifa_capturada: Number(tarifa_capturada) }
              : {}),
          }),
        );
        const productos = componentes.productos.map(
          ({ producto_id, cantidad, precio_unitario }) => ({
            producto_id,
            cantidad: Number(cantidad),
            ...(precio_unitario !== undefined
              ? { precio_unitario: Number(precio_unitario) }
              : {}),
          }),
        );
        const riego =
          valores.tipo_operacion === "riego" && componentes.riego
            ? Object.fromEntries(
                [
                  "inicio",
                  "fin",
                  "tarifa_hora",
                  "costo_agua",
                  "costo_valvulas",
                  "costo_operador",
                  "otros_costos",
                ].map((clave) => [
                  clave,
                  ["inicio", "fin"].includes(clave)
                    ? fechaCapturadaAISO(
                        String(
                          componentes.riego![
                            clave as keyof typeof componentes.riego
                          ],
                        ),
                      )
                    : Number(
                        componentes.riego![
                          clave as keyof typeof componentes.riego
                        ],
                      ),
                ]),
              )
            : null;
        Object.assign(cuerpo, { mano_obra, productos, riego });
        if (registro) {
          const camposTrabajo = [
            "cantidad",
            "porcentaje_asignacion",
            "tarifa_capturada",
          ];
          const camposProducto = ["cantidad", "precio_unitario"];
          if (
            compararPartidas(
              componentes.mano_obra,
              ["empleado_id"],
              camposTrabajo,
            ) ===
            compararPartidas(
              componentesIniciales.mano_obra,
              ["empleado_id"],
              camposTrabajo,
            )
          )
            delete cuerpo.mano_obra;
          if (
            compararPartidas(
              componentes.productos,
              ["producto_id"],
              camposProducto,
            ) ===
            compararPartidas(
              componentesIniciales.productos,
              ["producto_id"],
              camposProducto,
            )
          )
            delete cuerpo.productos;
          const camposRiego = [
            "tarifa_hora",
            "costo_agua",
            "costo_valvulas",
            "costo_operador",
            "otros_costos",
          ];
          if (
            valores.tipo_operacion === registro.tipo_operacion &&
            compararPartidas(
              componentes.riego ? [componentes.riego] : [],
              ["inicio", "fin"],
              camposRiego,
            ) ===
              compararPartidas(
                componentesIniciales.riego ? [componentesIniciales.riego] : [],
                ["inicio", "fin"],
                camposRiego,
              )
          )
            delete cuerpo.riego;
        }
        if (
          cuerpo.tipo_operacion === "riego" &&
          (!riego || !riego.inicio || !riego.fin)
        )
          throw new Error("Completa las fechas de inicio y fin del riego.");
      }
      await solicitar(
        "/api/" + modulo.recurso + (registro ? "/" + registro.id : ""),
        { method: registro ? "PATCH" : "POST", body: JSON.stringify(cuerpo) },
      );
      completar();
    } catch (fallo) {
      asignarError(mensajeError(fallo));
      if (fallo instanceof ErrorSolicitud && Array.isArray(fallo.errores))
        asignarErroresCampos(
          fallo.errores.filter(
            (detalle): detalle is ErrorCampo =>
              typeof detalle === "object" &&
              detalle !== null &&
              typeof detalle.campo === "string" &&
              typeof detalle.mensaje === "string",
          ),
        );
    } finally {
      asignarGuardando(false);
    }
  };
  if (cargando) return <Cargando texto="Cargando opciones del formulario..." />;
  return (
    <form onSubmit={enviar} className="formulario-registro">
      {error && (
        <div ref={resumenErrores} tabIndex={-1} className="mb-5">
          <Aviso error mensaje={error} />
          {erroresCampos.length > 0 && (
            <ul className="errores-formulario">
              {erroresCampos.map((detalle, indice) => (
                <li key={detalle.campo + indice}>
                  <strong>{nombreCampoError(detalle.campo, modulo)}:</strong>{" "}
                  {detalle.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="texto-ayuda mb-5">
        Los campos con asterisco son obligatorios.
      </p>
      <div className="rejilla-formulario">
        {modulo.campos
          .filter(
            (campo) =>
              campo.nombre !== "tipo_fertilizante" ||
              valores.tipo_operacion === "fertilizante",
          )
          .map((campo) => (
            <EntradaCampo
              key={campo.nombre}
              campo={campo}
              valor={valores[campo.nombre]}
              cambiar={(valor) =>
                asignarValores((anterior) => ({
                  ...anterior,
                  [campo.nombre]: valor,
                }))
              }
              opciones={opciones[campo.nombre]}
              error={
                erroresCampos
                  .filter((detalle) => detalle.campo === campo.nombre)
                  .map((detalle) => detalle.mensaje)
                  .join(" ") || undefined
              }
              requerido={campo.soloCrear ? !registro : campo.requerido}
            />
          ))}
      </div>
      {modulo.recurso === "operaciones" && (
        <DetalleCostosOperacion
          valores={componentes}
          cambiar={asignarComponentes}
          esRiego={valores.tipo_operacion === "riego"}
        />
      )}
      <footer className="pie-formulario">
        <button
          type="button"
          className="boton-secundario"
          onClick={cancelar}
          disabled={guardando}
        >
          Cancelar
        </button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? (
            <LoaderCircle size={17} className="animacion-carga" />
          ) : (
            <Save size={17} />
          )}
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </footer>
    </form>
  );
}
