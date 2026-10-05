import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  comprobarContrasena,
  protegerContrasena,
} from "../servidor/src/utilidades/contrasenas";
import {
  datosIniciales,
  esquemaMedicion,
  esquemaOperacion,
  fecha,
  filtrosConsulta,
} from "../servidor/src/utilidades/validacion";
import {
  autenticar,
  exigirPermiso,
  leerCookie,
  nombreCookie,
  permitirRoles,
  proteccionOrigen,
  resumirToken,
} from "../servidor/src/intermediarios/seguridad";
import { consultar } from "../servidor/src/base_datos/conexion";
import { validarEntrada } from "../servidor/src/servicios/registros";

vi.mock("../servidor/src/base_datos/conexion", () => ({ consultar: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe("Protección de contraseñas", () => {
  it("usa una sal distinta, verifica la clave correcta y rechaza claves incorrectas", async () => {
    const primero = await protegerContrasena("Una contraseña extensa y única");
    const segundo = await protegerContrasena("Una contraseña extensa y única");
    expect(primero).not.toEqual(segundo);
    expect(primero).not.toContain("contraseña");
    expect(
      await comprobarContrasena("Una contraseña extensa y única", primero),
    ).toBe(true);
    expect(await comprobarContrasena("Otra contraseña", primero)).toBe(false);
  });
  it("rechaza cuentas históricas sin contraseña y resúmenes corruptos", async () => {
    expect(await comprobarContrasena("Ejemplo de contraseña", null)).toBe(
      false,
    );
    expect(
      await comprobarContrasena(
        "Ejemplo de contraseña",
        "scrypt$2$1$1$incorrecto$00",
      ),
    ).toBe(false);
  });
});

describe("Validación de datos de campo", () => {
  const medicion = {
    lote_id: "lote-valido",
    profundidad_cm: 15,
    humedad_porcentaje: 35,
    conductividad_ce: 1.2,
    ph_suelo: 6.5,
    fecha_hora: "2026-09-22T10:30:00Z",
  };
  it("rechaza números no finitos, pH, humedad y fechas imposibles", () => {
    expect(esquemaMedicion.safeParse(medicion).success).toBe(true);
    for (const cambio of [
      { ph_suelo: 14.1 },
      { humedad_porcentaje: 101 },
      { profundidad_cm: -1 },
      { conductividad_ce: Infinity },
      { fecha_hora: "2026-02-30" },
      { fecha_hora: "2026-99-01" },
    ]) {
      expect(
        esquemaMedicion.safeParse({ ...medicion, ...cambio }).success,
      ).toBe(false);
    }
    expect(fecha.safeParse("2024-02-29").success).toBe(true);
    expect(fecha.safeParse("2025-02-29").success).toBe(false);
  });
  it("impide suplantar al usuario de una medición o imponer costos calculados", () => {
    expect(
      esquemaMedicion.safeParse({ ...medicion, usuario_id: "otra-persona" })
        .success,
    ).toBe(false);
    const operacion = {
      lote_id: "lote",
      tipo_operacion: "riego",
      encargado_id: "responsable",
      descripcion: "Riego de mantenimiento",
      fecha_operacion: "2026-09-22",
    };
    expect(esquemaOperacion.safeParse(operacion).success).toBe(true);
    expect(
      esquemaOperacion.safeParse({ ...operacion, encargado_id: "" }).success,
    ).toBe(false);
    expect(
      esquemaOperacion.safeParse({ ...operacion, costo_total: 1 }).success,
    ).toBe(false);
    expect(
      esquemaOperacion.safeParse({ ...operacion, encargado_historico: true })
        .success,
    ).toBe(false);
  });
  it("exige contraseña larga y limita paginación y rango de fechas", () => {
    expect(
      datosIniciales.safeParse({
        nombre: "Responsable",
        email: "persona@example.test",
        contrasena: "corta",
      }).success,
    ).toBe(false);
    expect(filtrosConsulta.safeParse({ limite: "101" }).success).toBe(false);
    expect(filtrosConsulta.safeParse({ pagina: "-1" }).success).toBe(false);
    expect(
      filtrosConsulta.safeParse({ desde: "2026-09-22", hasta: "2026-09-21" })
        .success,
    ).toBe(false);
  });
  it("conserva costos y estado al editar únicamente una descripción", () => {
    const anterior = {
      lote_id: "lote",
      tipo_operacion: "riego",
      encargado_id: "responsable",
      descripcion: "Riego inicial",
      fecha_operacion: "2026-09-22 10:30:00.000",
      estado: "pagada",
      costo_aplicacion: 7,
      otros_costos: 8,
    };
    const actualizado = validarEntrada(
      "operaciones",
      { descripcion: "Riego actualizado" },
      anterior,
    );
    expect(actualizado.costo_aplicacion).toBe(7);
    expect(actualizado.otros_costos).toBe(8);
    expect(actualizado.estado).toBe("pagada");
    expect(actualizado).not.toHaveProperty("mano_obra");
    expect(actualizado).not.toHaveProperty("productos");
    expect(actualizado).not.toHaveProperty("riego");
    expect(() => validarEntrada("operaciones", {}, anterior)).toThrow(
      "No hay cambios",
    );
  });
});

describe("Sesiones, permisos y origen", () => {
  const respuesta = { setHeader: vi.fn() } as unknown as Response;
  const solicitudOrigen = (
    origen?: string,
    cabecera = "1",
    tipo = "application/json",
  ) =>
    ({
      method: "POST",
      get: (nombre: string) =>
        nombre === "Origin"
          ? origen
          : nombre === "X-Solicitud-Segura"
            ? cabecera
            : undefined,
      is: (esperado: string) => esperado === tipo,
    }) as Request;
  it("rechaza orígenes externos, formularios y solicitudes sin cabecera de seguridad", () => {
    const comprobar = proteccionOrigen("https://agricola.example.test");
    expect(() =>
      comprobar(
        solicitudOrigen("https://intruso.example.test"),
        respuesta,
        vi.fn(),
      ),
    ).toThrow("origen");
    expect(() =>
      comprobar(
        solicitudOrigen(undefined, "", "application/json"),
        respuesta,
        vi.fn(),
      ),
    ).toThrow("seguridad");
    expect(() =>
      comprobar(
        solicitudOrigen(undefined, "1", "text/plain"),
        respuesta,
        vi.fn(),
      ),
    ).toThrow("seguridad");
    const siguiente = vi.fn();
    comprobar(
      solicitudOrigen("https://agricola.example.test"),
      respuesta,
      siguiente,
    );
    expect(siguiente).toHaveBeenCalledOnce();
  });
  it("rechaza cookies manipuladas y sesiones expiradas o revocadas", async () => {
    expect(leerCookie(`${nombreCookie}=invalido`)).toBeNull();
    const token = "a".repeat(64);
    expect(leerCookie(`otra=1; ${nombreCookie}=${token}`)).toBe(token);
    vi.mocked(consultar).mockResolvedValueOnce([]);
    const solicitud = {
      headers: { cookie: `${nombreCookie}=${token}` },
    } as Request;
    await expect(autenticar(solicitud, respuesta, vi.fn())).rejects.toThrow(
      "expiró",
    );
    expect(vi.mocked(consultar).mock.calls[0][1]).toEqual([
      resumirToken(token),
    ]);
    expect(resumirToken(token)).not.toBe(token);
  });
  it("rechaza acceso administrativo de un operador y permisos no concedidos", async () => {
    const solicitud = {
      usuario: { id: "persona", rol: "operador" },
    } as Request;
    expect(() => permitirRoles("admin")(solicitud, respuesta, vi.fn())).toThrow(
      "permisos",
    );
    vi.mocked(consultar).mockResolvedValueOnce([]);
    await expect(
      exigirPermiso("operaciones.editar")(solicitud, respuesta, vi.fn()),
    ).rejects.toThrow("permisos");
    vi.mocked(consultar).mockResolvedValueOnce([
      { permiso: "operaciones.crear" },
    ]);
    const siguiente = vi.fn();
    await exigirPermiso("operaciones.crear")(solicitud, respuesta, siguiente);
    expect(siguiente).toHaveBeenCalledOnce();
  });
});
