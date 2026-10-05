import { z } from "zod";
import { fechaCampoAUTC } from "./fechas";

z.config(z.locales.es());
export const identificador = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[\p{L}\p{N}_:-]+$/u, "El identificador no es válido.");
const texto = (limite = 2000) =>
  z.string().trim().max(limite).nullable().optional();
const numero = (maximo = 99999999) =>
  z.number().finite().nonnegative().max(maximo);
const decimal = (maximo: number, posiciones: number) =>
  numero(maximo).refine(
    (valor) => valor === Number(valor.toFixed(posiciones)),
    `El valor admite hasta ${posiciones} decimales.`,
  );
const importe = () => decimal(9999999999.99, 2);
const precio = () => decimal(99999999.9999, 4);
const fechaValida = (valor: string) => {
  const partes =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(
      valor,
    );
  if (!partes || Number(partes[1]) < 1900 || Number(partes[1]) > 2200)
    return false;
  const fecha = new Date(`${partes[1]}-${partes[2]}-${partes[3]}T00:00:00Z`);
  return (
    !isNaN(fecha.getTime()) &&
    !isNaN(Date.parse(valor)) &&
    fecha.toISOString().slice(0, 10) === valor.slice(0, 10)
  );
};
export const fecha = z
  .string()
  .refine(fechaValida, "Introduce una fecha válida en formato año-mes-día.");
const estado = z.enum(["activo", "inactivo"]);
export const contrasena = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(128, "La contraseña no puede superar 128 caracteres.");
export const datosAcceso = z
  .object({
    email: z.email().trim().toLowerCase().max(191),
    contrasena: z.string().min(1).max(128),
  })
  .strict();
export const datosIniciales = z
  .object({
    nombre: z.string().trim().min(3).max(160),
    email: z.email().trim().toLowerCase().max(191),
    contrasena,
  })
  .strict();
export const datosUsuario = datosIniciales.extend({
  rol: z.enum(["admin", "encargado", "operador"]),
  estado: estado.default("activo"),
});

export const esquemaLote = z
  .object({
    nombre_lote: z.string().trim().min(2).max(120),
    codigo: z.string().trim().min(2).max(40).toUpperCase(),
    superficie_ha: decimal(99999999, 6),
    variedad: texto(191),
    fecha_siembra: fecha
      .refine(
        (valor) => valor.length === 10,
        "La fecha de siembra debe indicarse sin hora.",
      )
      .nullable()
      .optional(),
    unidad_superficie: z
      .enum(["hectarea", "metro_cuadrado", "acre"])
      .default("hectarea"),
    superficie_original: decimal(99999999.9999, 4).nullable().optional(),
    estado: estado.default("activo"),
    ubicacion: texto(191),
    latitud: z
      .number()
      .finite()
      .min(-90)
      .max(90)
      .refine(
        (valor) => valor === Number(valor.toFixed(7)),
        "La latitud admite hasta 7 decimales.",
      )
      .nullable()
      .optional(),
    longitud: z
      .number()
      .finite()
      .min(-180)
      .max(180)
      .refine(
        (valor) => valor === Number(valor.toFixed(7)),
        "La longitud admite hasta 7 decimales.",
      )
      .nullable()
      .optional(),
    centroide: z
      .union([
        z.record(z.string(), z.unknown()),
        z.tuple([z.number().finite(), z.number().finite()]),
      ])
      .nullable()
      .optional(),
    geometria: z.record(z.string(), z.unknown()).nullable().optional(),
    notas: texto(),
    lote_padre_id: identificador.nullable().optional(),
    finca_id: identificador.nullable().optional(),
  })
  .strict();
export const esquemaCultivo = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    variedad: texto(191),
    estado: estado.default("activo"),
    descripcion: texto(),
    notas: texto(),
  })
  .strict();
export const esquemaEmpleado = z
  .object({
    nombre_completo: z.string().trim().min(3).max(160),
    tarifa_actual: importe(),
    tipo_pago: z.enum(["hora", "dia", "jornal", "semana", "mes", "otro"]),
    unidad_pago: z.string().trim().min(1).max(80),
    estado: estado.default("activo"),
    fecha_contratacion: fecha.nullable().optional(),
    notas: texto(),
  })
  .strict();
export const esquemaProducto = z
  .object({
    codigo: z.string().trim().min(2).max(40).toUpperCase(),
    nombre: z.string().trim().min(2).max(160),
    categoria: z.enum([
      "fertilizante",
      "fungicida",
      "insecticida",
      "herbicida",
      "adyuvante",
      "otro",
    ]),
    unidad_base: z.string().trim().min(1).max(32),
    precio_actual: precio().nullable().optional(),
    proveedor: texto(191),
    activo: z.boolean().default(true),
    notas: texto(),
  })
  .strict();
export const esquemaMedicion = z
  .object({
    lote_id: identificador,
    profundidad_cm: decimal(1000, 2),
    humedad_porcentaje: decimal(100, 2),
    conductividad_ce: decimal(100, 4),
    ph_suelo: decimal(14, 2),
    fecha_hora: fecha,
    observaciones: texto(),
  })
  .strict();

export const esquemaManoObra = z
  .object({
    empleado_id: identificador,
    cantidad: decimal(100000, 4).default(1),
    porcentaje_asignacion: decimal(100, 2).nullable().optional(),
    tarifa_capturada: importe().optional(),
  })
  .strict();
export const esquemaAplicacionProducto = z
  .object({
    producto_id: identificador,
    cantidad: decimal(1000000, 4),
    precio_unitario: precio().optional(),
  })
  .strict();
export const esquemaRiego = z
  .object({
    inicio: fecha,
    fin: fecha,
    tarifa_hora: precio().default(0),
    costo_agua: importe().default(0),
    costo_valvulas: importe().default(0),
    costo_operador: importe().default(0),
    otros_costos: importe().default(0),
  })
  .strict();
export const esquemaOperacion = z
  .object({
    lote_id: identificador,
    tipo_operacion: z.enum([
      "riego",
      "fertilizante",
      "herbicida",
      "practica_general",
      "fumigacion",
      "otro",
    ]),
    encargado_id: identificador,
    descripcion: z.string().trim().min(3).max(2000),
    cantidad_dosificacion: decimal(9999999999.9999, 4).nullable().optional(),
    unidad_dosificacion: texto(32),
    fecha_operacion: fecha,
    observaciones: texto(),
    estado: z
      .enum(["borrador", "confirmada", "pagada", "pendiente_pago", "cancelada"])
      .default("confirmada"),
    tipo_fertilizante: texto(191),
    cultivo_id: identificador.nullable().optional(),
    costo_aplicacion: importe().default(0),
    otros_costos: importe().default(0),
    mano_obra: z.array(esquemaManoObra).max(100).optional(),
    productos: z.array(esquemaAplicacionProducto).max(100).optional(),
    riego: esquemaRiego.nullable().optional(),
  })
  .strict();

export const esquemas = {
  lotes: esquemaLote,
  cultivos: esquemaCultivo,
  empleados: esquemaEmpleado,
  productos: esquemaProducto,
  mediciones: esquemaMedicion,
  operaciones: esquemaOperacion,
};
export type Recurso = keyof typeof esquemas;

export const filtrosConsulta = z
  .object({
    pagina: z.coerce.number().int().min(1).max(100000).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(25),
    buscar: z.string().trim().max(160).optional(),
    estado: z.string().max(32).optional(),
    rol: z.enum(["admin", "encargado", "operador"]).optional(),
    lote_id: identificador.optional(),
    encargado_id: identificador.optional(),
    usuario_id: identificador.optional(),
    tipo_operacion: esquemaOperacion.shape.tipo_operacion.optional(),
    tipo_fertilizante: z.string().max(191).optional(),
    categoria: esquemaProducto.shape.categoria.optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
    modulo: z.string().max(80).optional(),
  })
  .strict()
  .refine(
    (valor) =>
      !valor.desde ||
      !valor.hasta ||
      valor.desde.slice(0, 10) <= valor.hasta.slice(0, 10),
    {
      message: "La fecha inicial no puede ser posterior a la final.",
      path: ["desde"],
    },
  );

export function normalizarFecha(valor: string) {
  return fechaCampoAUTC(valor);
}
