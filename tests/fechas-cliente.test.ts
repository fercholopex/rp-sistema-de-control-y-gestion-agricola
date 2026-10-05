import { describe, expect, it } from "vitest";
import {
  dinero,
  fechaCapturadaAISO,
  fechaFormulario,
  fechaLegible,
} from "../cliente/src/servicios/http";

describe("Fechas del cliente en la zona horaria configurada", () => {
  it("convierte una captura de Guatemala a UTC sin usar la zona del navegador", () => {
    expect(fechaCapturadaAISO("2026-09-22T08:30", "America/Guatemala")).toBe(
      "2026-09-22T14:30:00.000Z",
    );
    expect(
      fechaFormulario("2026-09-22T14:30:00.000Z", true, "America/Guatemala"),
    ).toBe("2026-09-22T08:30");
  });
  it("conserva el día de fechas sin hora", () => {
    expect(fechaFormulario("2026-09-22")).toBe("2026-09-22");
    expect(fechaLegible("2026-09-22", false, "America/Guatemala")).toContain(
      "22",
    );
  });
  it("convierte cruces de medianoche y cambios de fecha", () => {
    expect(fechaCapturadaAISO("2026-12-31T23:45", "America/Guatemala")).toBe(
      "2027-01-01T05:45:00.000Z",
    );
    expect(
      fechaFormulario("2027-01-01T05:45:00.000Z", true, "America/Guatemala"),
    ).toBe("2026-12-31T23:45");
  });
  it("respeta zonas con desplazamientos de media hora", () => {
    expect(fechaCapturadaAISO("2026-09-22T08:30", "Asia/Kolkata")).toBe(
      "2026-09-22T03:00:00.000Z",
    );
  });
  it("rechaza horas inexistentes durante cambios de horario", () => {
    expect(() =>
      fechaCapturadaAISO("2026-03-08T02:30", "America/New_York"),
    ).toThrow("no existe");
  });
  it("elige la primera ocurrencia de una hora repetida", () => {
    expect(fechaCapturadaAISO("2026-11-01T01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
  });
  it("rechaza fechas imposibles y zonas inválidas", () => {
    expect(() =>
      fechaCapturadaAISO("2026-02-30T08:30", "America/Guatemala"),
    ).toThrow("válidas");
    expect(() =>
      fechaCapturadaAISO("2026-09-22T25:30", "America/Guatemala"),
    ).toThrow("válidas");
    expect(() =>
      fechaCapturadaAISO("2026-09-22T08:30", "Zona/Inexistente"),
    ).toThrow("zona horaria");
  });
});

describe("Formato de moneda", () => {
  it("formatea importes en pesos mexicanos (MXN)", () => {
    const formateado = dinero(1250.5);
    expect(formateado).toContain("$");
    expect(formateado).toMatch(/1,250\.50/);
  });
  it("maneja valores nulos o indefinidos como cero pesos", () => {
    expect(dinero(null)).toMatch(/\$0\.00/);
    expect(dinero(undefined)).toMatch(/\$0\.00/);
  });
});

