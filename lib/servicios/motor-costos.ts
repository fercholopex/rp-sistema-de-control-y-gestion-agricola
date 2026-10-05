export type ParticipanteManoObra = {
  empleado_id: string;
  nombre_empleado: string;
  tarifa_capturada: number;
  cantidad?: number;
  porcentaje_asignacion?: number;
};

export type EntradaCostoProducto = {
  cantidad: number;
  precio_unitario: number;
};

export type EntradaCostoRiego = {
  inicio: Date;
  fin: Date;
  tarifa_hora?: number;
  costo_agua?: number;
  costo_valvula?: number;
  costo_operador?: number;
  otros_costos?: number;
};

function exigirNoNegativo(valor: number, etiqueta: string) {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error(
      etiqueta + " debe ser un número finito mayor o igual que cero.",
    );
  }
}

function moneda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularCostoManoObra(participantes: ParticipanteManoObra[]) {
  if (participantes.length === 0) {
    return { partidas: [], total: 0 };
  }

  const asignaciones = participantes.filter(
    (participante) => participante.porcentaje_asignacion !== undefined,
  );
  for (const participante of asignaciones) {
    exigirNoNegativo(
      participante.porcentaje_asignacion!,
      "Porcentaje de asignación",
    );
    if (participante.porcentaje_asignacion! > 100)
      throw new Error("El porcentaje de asignación no puede superar 100.");
  }
  if (asignaciones.length > 0 && asignaciones.length !== participantes.length) {
    throw new Error(
      "Los porcentajes deben indicarse para todos los participantes o para ninguno.",
    );
  }

  const asignacionTotal = asignaciones.reduce(
    (suma, participante) => suma + (participante.porcentaje_asignacion ?? 0),
    0,
  );
  if (asignaciones.length > 0 && Math.abs(asignacionTotal - 100) > 0.01) {
    throw new Error("Los porcentajes deben sumar 100.");
  }

  const partidas = participantes.map((participante) => {
    const cantidad = participante.cantidad ?? 1;
    exigirNoNegativo(participante.tarifa_capturada, "Tarifa de mano de obra");
    exigirNoNegativo(cantidad, "Cantidad de mano de obra");
    return {
      ...participante,
      cantidad,
      costo_individual: moneda(participante.tarifa_capturada * cantidad),
    };
  });

  return {
    partidas,
    total: moneda(
      partidas.reduce((suma, partida) => suma + partida.costo_individual, 0),
    ),
  };
}

export function calcularCostoProducto(entrada: EntradaCostoProducto) {
  exigirNoNegativo(entrada.cantidad, "Cantidad de producto");
  exigirNoNegativo(entrada.precio_unitario, "Precio unitario del producto");
  return moneda(entrada.cantidad * entrada.precio_unitario);
}

export function calcularCostoAplicacion(participantes: ParticipanteManoObra[]) {
  return calcularCostoManoObra(participantes);
}

export function calcularCostoRiego(entrada: EntradaCostoRiego) {
  if (
    !Number.isFinite(entrada.inicio.getTime()) ||
    !Number.isFinite(entrada.fin.getTime()) ||
    entrada.fin <= entrada.inicio
  ) {
    throw new Error(
      "La fecha de fin del riego debe ser posterior a la de inicio.",
    );
  }

  const duracion_horas =
    (entrada.fin.getTime() - entrada.inicio.getTime()) / 3_600_000;
  const tarifa_hora = entrada.tarifa_hora ?? 0;
  const costo_agua = entrada.costo_agua ?? 0;
  const costo_valvula = entrada.costo_valvula ?? 0;
  const costo_operador = entrada.costo_operador ?? 0;
  const otros_costos = entrada.otros_costos ?? 0;

  [
    tarifa_hora,
    costo_agua,
    costo_valvula,
    costo_operador,
    otros_costos,
  ].forEach((valor) => exigirNoNegativo(valor, "Costo de riego"));

  const costo_tarifa = moneda(duracion_horas * tarifa_hora);
  return {
    duracion_horas: moneda(duracion_horas),
    costo_tarifa,
    costo_agua: moneda(costo_agua),
    costo_valvula: moneda(costo_valvula),
    costo_operador: moneda(costo_operador),
    otros_costos: moneda(otros_costos),
    total: moneda(
      costo_tarifa + costo_agua + costo_valvula + costo_operador + otros_costos,
    ),
  };
}

export function calcularCostoOperacion(costos: {
  costo_mano_obra?: number;
  costo_productos?: number;
  costo_aplicacion?: number;
  costo_riego?: number;
  otros_costos?: number;
}) {
  const valores = [
    costos.costo_mano_obra ?? 0,
    costos.costo_productos ?? 0,
    costos.costo_aplicacion ?? 0,
    costos.costo_riego ?? 0,
    costos.otros_costos ?? 0,
  ];

  valores.forEach((valor) => exigirNoNegativo(valor, "Costo de operación"));
  return moneda(valores.reduce((suma, valor) => suma + valor, 0));
}

export function calcularCostoAgricolaTotal(totalesOperaciones: number[]) {
  totalesOperaciones.forEach((valor) =>
    exigirNoNegativo(valor, "Total de la operación"),
  );
  return moneda(totalesOperaciones.reduce((suma, valor) => suma + valor, 0));
}
