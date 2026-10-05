import { describe, expect, it } from "vitest";
import {
  calcularCostoOperacion,
  calcularCostoRiego,
  calcularCostoManoObra,
  calcularCostoProducto,
  calcularCostoAgricolaTotal,
} from "@/lib/servicios/motor-costos";

describe("motor de costos agrícolas", () => {
  it("conserva la tarifa individual histórica de cada participante", () => {
    const resultado = calcularCostoManoObra([
      { empleado_id: "saul", nombre_empleado: "Saúl", tarifa_capturada: 416 },
      {
        empleado_id: "brandon",
        nombre_empleado: "Brandon",
        tarifa_capturada: 640,
      },
    ]);

    expect(
      resultado.partidas.map((partida) => partida.costo_individual),
    ).toEqual([416, 640]);
    expect(resultado.total).toBe(1056);
  });

  it("calcula el costo de producto con precio capturado", () => {
    expect(calcularCostoProducto({ cantidad: 300, precio_unitario: 6 })).toBe(
      1800,
    );
  });

  it("calcula duración y componentes de riego sin duplicar costos", () => {
    const resultado = calcularCostoRiego({
      inicio: new Date("2026-09-07T08:00:00"),
      fin: new Date("2026-09-07T10:30:00"),
      tarifa_hora: 50,
      costo_agua: 80,
      costo_valvula: 20,
      costo_operador: 100,
      otros_costos: 10,
    });

    expect(resultado.duracion_horas).toBe(2.5);
    expect(resultado.costo_tarifa).toBe(125);
    expect(resultado.total).toBe(335);
  });

  it("rechaza intervalos de riego inválidos", () => {
    expect(() =>
      calcularCostoRiego({
        inicio: new Date("2026-09-07T10:00:00"),
        fin: new Date("2026-09-07T09:00:00"),
      }),
    ).toThrow("La fecha de fin del riego");
  });

  it("suma cada componente de costo una vez", () => {
    const total = calcularCostoOperacion({
      costo_mano_obra: 1056,
      costo_productos: 1800,
      costo_aplicacion: 200,
      costo_riego: 335,
      otros_costos: 10,
    });

    expect(total).toBe(3401);
    expect(calcularCostoAgricolaTotal([total, 599])).toBe(4000);
  });
});
