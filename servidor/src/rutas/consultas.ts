import { Router } from "express";
import { z } from "zod";
import { consultar, transaccion } from "../base_datos/conexion";
import { exigirPermiso } from "../intermediarios/seguridad";
import { obtenerClima } from "../servicios/clima";
import { normalizarFila } from "../servicios/registros";
import { identificador } from "../utilidades/validacion";
import { periodosResumen } from "../utilidades/fechas";

export function rutasConsultas() {
  const rutas = Router();
  rutas.get(
    "/resumen",
    exigirPermiso("operaciones.consultar"),
    async (_solicitud, respuesta) => {
      const datos = await transaccion(async (conexion) => {
        const periodos = periodosResumen();
        const validas = "fecha_eliminacion IS NULL AND estado<>'cancelada'";
        const [sumas] = await consultar(
          `SELECT COALESCE(SUM(costo_total),0) total,COALESCE(SUM(CASE WHEN fecha_operacion>=? AND fecha_operacion<? THEN costo_total ELSE 0 END),0) semana,COALESCE(SUM(CASE WHEN fecha_operacion>=? AND fecha_operacion<? THEN costo_total ELSE 0 END),0) mes,COALESCE(SUM(costo_mano_obra),0) mano_obra,COALESCE(SUM(costo_riego),0) riego,COALESCE(SUM(costo_productos),0) productos,COUNT(*) operaciones FROM operaciones_campo WHERE ${validas}`,
          [
            periodos.inicio_semana,
            periodos.fin_semana,
            periodos.inicio_mes,
            periodos.fin_mes,
          ],
          conexion,
        );
        const [lotes] = await consultar(
          "SELECT COUNT(*) total FROM lotes WHERE fecha_eliminacion IS NULL AND estado='activo'",
          [],
          conexion,
        );
        const [mediciones] = await consultar(
          "SELECT COUNT(*) total FROM mediciones_campo WHERE fecha_eliminacion IS NULL",
          [],
          conexion,
        );
        const categorias = await consultar(
          `SELECT tipo_operacion nombre,SUM(costo_total) total FROM operaciones_campo WHERE ${validas} GROUP BY tipo_operacion ORDER BY total DESC`,
          [],
          conexion,
        );
        const porLote = await consultar(
          "SELECT l.nombre_lote nombre,SUM(o.costo_total) total FROM operaciones_campo o JOIN lotes l ON l.id=o.lote_id WHERE o.fecha_eliminacion IS NULL AND o.estado<>'cancelada' GROUP BY l.id,l.nombre_lote ORDER BY total DESC",
          [],
          conexion,
        );
        // Los límites se calculan en la zona de la finca; MySQL no necesita cargar tablas de zonas horarias.
        const columnasDias = periodos.dias.map(
          (_, indice) =>
            `COALESCE(SUM(CASE WHEN fecha_operacion>=? AND fecha_operacion<? THEN costo_total ELSE 0 END),0) dia_${indice}`,
        );
        const [sumasDias] = await consultar(
          `SELECT ${columnasDias.join(",")} FROM operaciones_campo WHERE ${validas} AND fecha_operacion>=? AND fecha_operacion<?`,
          [
            ...periodos.dias.flatMap((dia) => [dia.inicio, dia.fin]),
            periodos.dias[0].inicio,
            periodos.dias[6].fin,
          ],
          conexion,
        );
        const porDia = periodos.dias.map((dia, indice) => ({
          fecha: dia.fecha,
          total: Number(sumasDias[`dia_${indice}`]),
        }));
        const actividad = await consultar(
          "SELECT o.*,l.nombre_lote,u.nombre nombre_encargado FROM operaciones_campo o JOIN lotes l ON l.id=o.lote_id LEFT JOIN usuarios u ON u.id=o.encargado_id WHERE o.fecha_eliminacion IS NULL AND o.estado<>'cancelada' ORDER BY o.fecha_operacion DESC,o.id LIMIT 8",
          [],
          conexion,
        );
        return {
          totales: {
            ...sumas,
            lotes: Number(lotes.total),
            mediciones: Number(mediciones.total),
          },
          costos_por_categoria: categorias,
          costos_por_lote: porLote,
          costos_por_dia: porDia,
          actividad_reciente: actividad.map(normalizarFila),
          zona_horaria: periodos.zona,
        };
      });
      respuesta.json({ exito: true, datos });
    },
  );
  rutas.get(
    "/clima",
    exigirPermiso("clima.consultar"),
    async (solicitud, respuesta) => {
      const { lote_id } = z
        .object({ lote_id: identificador })
        .strict()
        .parse(solicitud.query);
      respuesta.json({ exito: true, datos: await obtenerClima(lote_id) });
    },
  );
  return rutas;
}
