export type Registro = Record<string, unknown> & { id: string };
export type Respuesta<T> = {
  exito: true;
  datos: T;
  total?: number;
  pagina?: number;
  limite?: number;
};

export class ErrorSolicitud extends Error {
  constructor(
    mensaje: string,
    public estado: number,
    public errores?: unknown,
  ) {
    super(mensaje);
  }
}

export async function solicitar<T>(
  ruta: string,
  opciones: RequestInit = {},
): Promise<Respuesta<T>> {
  const modifica = !["GET", "HEAD"].includes(
    (opciones.method ?? "GET").toUpperCase(),
  );
  const respuesta = await fetch(ruta, {
    ...opciones,
    body: opciones.body ?? (modifica ? "{}" : undefined),
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(modifica
        ? { "Content-Type": "application/json", "X-Solicitud-Segura": "1" }
        : {}),
      ...opciones.headers,
    },
  });
  let contenido;
  try {
    contenido = await respuesta.json();
  } catch {
    throw new ErrorSolicitud(
      "El servidor no pudo responder. Vuelve a intentarlo.",
      respuesta.status,
    );
  }
  if (!respuesta.ok || !contenido.exito) {
    if (respuesta.status === 401 && !ruta.includes("/autenticacion/"))
      window.dispatchEvent(new Event("sesion-expirada"));
    throw new ErrorSolicitud(
      contenido.mensaje || "No se pudo completar la solicitud.",
      respuesta.status,
      contenido.errores,
    );
  }
  return contenido as Respuesta<T>;
}

export async function obtenerOpciones(ruta: string): Promise<Registro[]> {
  const registros: Registro[] = [];
  let pagina = 1;
  for (;;) {
    const respuesta = await solicitar<Registro[]>(
      ruta +
        (ruta.includes("?") ? "&" : "?") +
        new URLSearchParams({ pagina: String(pagina), limite: "100" }),
    );
    registros.push(...respuesta.datos);
    if (
      respuesta.total === undefined ||
      registros.length >= respuesta.total ||
      respuesta.datos.length === 0
    )
      return registros;
    pagina++;
  }
}

export const mensajeError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Ocurrió un error al consultar la información.";
export const dinero = (valor: unknown) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    Number(valor ?? 0),
  );
export const zonaHoraria =
  process.env.NEXT_PUBLIC_ZONA_HORARIA || "America/Mexico_City";

function partesFecha(fecha: Date, zona: string) {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(fecha);
  } catch {
    throw new Error("La zona horaria configurada no es válida.");
  }
  return Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
}

export function fechaLegible(valor: unknown, hora = false, zona = zonaHoraria) {
  if (!valor) return "Sin registrar";
  const fecha = new Date(String(valor));
  return Number.isNaN(fecha.getTime())
    ? "Sin registrar"
    : new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        ...(hora ? { timeStyle: "short" as const } : {}),
        timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(valor)) ? "UTC" : zona,
      }).format(fecha);
}

export function fechaFormulario(
  valor: unknown,
  hora = false,
  zona = zonaHoraria,
) {
  if (!valor) return "";
  if (!hora) return String(valor).slice(0, 10);
  const fecha = new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = partesFecha(fecha, zona);
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

export function fechaCapturadaAISO(valor: string, zona = zonaHoraria) {
  const coincidencia =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor);
  if (!coincidencia) throw new Error("Introduce una fecha y hora válidas.");
  const [, ano, mes, dia, hora, minuto, segundo = "00"] = coincidencia;
  const fechaLocal = Date.UTC(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo),
  );
  const esperado = `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  if (new Date(fechaLocal).toISOString().slice(0, 19) !== esperado)
    throw new Error("Introduce una fecha y hora válidas.");
  const desplazamientos = new Set<number>();
  for (const horas of [-36, -12, 0, 12, 36]) {
    const instante = fechaLocal + horas * 3600000;
    const partes = partesFecha(new Date(instante), zona);
    const representacion = Date.UTC(
      Number(partes.year),
      Number(partes.month) - 1,
      Number(partes.day),
      Number(partes.hour),
      Number(partes.minute),
      Number(partes.second),
    );
    desplazamientos.add(representacion - instante);
  }
  const candidatos: number[] = [];
  for (const desplazamiento of desplazamientos) {
    const candidato = fechaLocal - desplazamiento;
    const partes = partesFecha(new Date(candidato), zona);
    if (
      `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}` ===
      esperado
    )
      candidatos.push(candidato);
  }
  if (!candidatos.length)
    throw new Error(
      "La hora seleccionada no existe en la zona horaria configurada debido a un cambio de horario. Elige otra hora.",
    );
  // Si un cambio de horario repite la misma hora, se conserva la primera ocurrencia.
  return new Date(Math.min(...candidatos)).toISOString();
}
