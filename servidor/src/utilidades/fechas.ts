const formateadores = new Map<string, Intl.DateTimeFormat>();

/** MariaDB serializa Date con la zona del proceso; enviar texto UTC evita una segunda conversión. */
export function fechaParaSQL(instante: Date) {
  return instante.toISOString().replace("T", " ").replace("Z", "");
}

export function obtenerZonaHoraria() {
  const zona = process.env.ZONA_HORARIA || "America/Mexico_City";
  try {
    formateador(zona);
  } catch {
    throw new Error("ZONA_HORARIA no corresponde a una zona horaria válida.");
  }
  return zona;
}

function formateador(zona: string) {
  let formato = formateadores.get(zona);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formateadores.set(zona, formato);
  }
  return formato;
}

function partesLocales(instante: Date, zona: string) {
  return Object.fromEntries(
    formateador(zona)
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  );
}

export function fechaLocal(instante: Date, zona = obtenerZonaHoraria()) {
  const partes = partesLocales(instante, zona);
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function desplazarDia(fecha: string, dias: number) {
  const instante = new Date(`${fecha}T00:00:00Z`);
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString().slice(0, 10);
}

/** Convierte una hora de campo a UTC sin depender de la zona del proceso ni de tablas horarias de MySQL. */
export function fechaCampoAUTC(valor: string, zona = obtenerZonaHoraria()) {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(valor)) return new Date(valor);
  const local = valor.length === 10 ? `${valor}T00:00:00` : valor;
  const referencia = new Date(`${local}Z`).getTime();
  let candidato = referencia;
  for (let paso = 0; paso < 4; paso++) {
    const partes = partesLocales(new Date(candidato), zona);
    const representada = Date.UTC(
      Number(partes.year),
      Number(partes.month) - 1,
      Number(partes.day),
      Number(partes.hour),
      Number(partes.minute),
      Number(partes.second),
    );
    const siguiente =
      referencia - (representada - Math.floor(candidato / 1000) * 1000);
    if (siguiente === candidato) break;
    candidato = siguiente;
  }
  return new Date(candidato);
}

export function periodosResumen(
  ahora = new Date(),
  zona = obtenerZonaHoraria(),
) {
  const hoy = fechaLocal(ahora, zona);
  const calendario = new Date(`${hoy}T00:00:00Z`);
  const inicioSemana = desplazarDia(hoy, -((calendario.getUTCDay() + 6) % 7));
  const mesSiguiente = new Date(
    Date.UTC(calendario.getUTCFullYear(), calendario.getUTCMonth() + 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  const dias = Array.from({ length: 7 }, (_, indice) => {
    const fecha = desplazarDia(hoy, indice - 6);
    return {
      fecha,
      inicio: fechaCampoAUTC(fecha, zona),
      fin: fechaCampoAUTC(desplazarDia(fecha, 1), zona),
    };
  });
  return {
    zona,
    inicio_semana: fechaCampoAUTC(inicioSemana, zona),
    fin_semana: fechaCampoAUTC(desplazarDia(inicioSemana, 7), zona),
    inicio_mes: fechaCampoAUTC(hoy.slice(0, 7) + "-01", zona),
    fin_mes: fechaCampoAUTC(mesSiguiente, zona),
    dias,
  };
}
