"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Droplets,
  Leaf,
  Map,
  Package,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  dinero,
  fechaLegible,
  mensajeError,
  solicitar,
  type Registro,
} from "@/cliente/src/servicios/http";
import {
  etiquetaValor,
  tiposOperacion,
} from "@/cliente/src/configuracion/modulos";
import { Aviso, Cabecera, Cargando } from "@/components/elementos";

type Resumen = {
  totales: {
    total: number;
    semana: number;
    mes: number;
    mano_obra: number;
    riego: number;
    productos: number;
    lotes: number;
    mediciones: number;
    operaciones: number;
  };
  costos_por_categoria: Array<{ nombre: string; total: number }>;
  costos_por_lote: Array<{ nombre: string; total: number }>;
  costos_por_dia: Array<{ fecha: string; total: number }>;
  actividad_reciente: Registro[];
};

export function Indicador({
  titulo,
  valor,
  descripcion,
  icono: Icono,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  descripcion: string;
  icono: LucideIcon;
  destacado?: boolean;
}) {
  return (
    <article
      className={
        "indicador tarjeta " + (destacado ? "indicador-destacado" : "")
      }
    >
      <div>
        <p>{titulo}</p>
        <Icono size={20} strokeWidth={1.7} />
      </div>
      <strong>{valor}</strong>
      <small>{descripcion}</small>
    </article>
  );
}

export function ResumenAgricola() {
  const [resumen, asignarResumen] = useState<Resumen | null>(null);
  const [error, asignarError] = useState("");
  const [intento, asignarIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    solicitar<Resumen>("/api/resumen")
      .then((respuesta) => {
        if (vigente) asignarResumen(respuesta.datos);
      })
      .catch((fallo) => {
        if (vigente) asignarError(mensajeError(fallo));
      });
    return () => {
      vigente = false;
    };
  }, [intento]);
  return (
    <>
      <Cabecera
        titulo="Tu campo, bajo control."
        descripcion="Una vista clara de tus operaciones, sus costos y la actividad reciente."
        acciones={
          <button
            type="button"
            className="boton-secundario"
            onClick={() => {
              asignarError("");
              asignarResumen(null);
              asignarIntento(intento + 1);
            }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      />
      {error && <Aviso error mensaje={error} />}
      {!resumen ? (
        error ? (
          <div className="tarjeta estado-vacio">
            <p>La información no está disponible.</p>
            <button
              type="button"
              className="boton"
              onClick={() => {
                asignarError("");
                asignarResumen(null);
                asignarIntento(intento + 1);
              }}
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          <Cargando />
        )
      ) : (
        <>
          <section className="rejilla-indicadores">
            <Indicador
              titulo="Gasto total"
              valor={dinero(resumen.totales.total)}
              descripcion="Historial registrado"
              icono={Leaf}
              destacado
            />
            <Indicador
              titulo="Esta semana"
              valor={dinero(resumen.totales.semana)}
              descripcion="Desde el lunes"
              icono={CalendarDays}
            />
            <Indicador
              titulo="Este mes"
              valor={dinero(resumen.totales.mes)}
              descripcion="Acumulado mensual"
              icono={CalendarDays}
            />
            <Indicador
              titulo="Lotes activos"
              valor={String(resumen.totales.lotes)}
              descripcion="Unidades del campo"
              icono={Map}
            />
          </section>
          <section className="rejilla-resumen">
            <article className="tarjeta p-6">
              <div className="cabecera-seccion mt-0">
                <div>
                  <h2>Evolución de gastos</h2>
                  <p className="texto-ayuda">Últimos 7 días · MXN</p>
                </div>
                <span className="insignia">Semanal</span>
              </div>
              {resumen.costos_por_dia.some((dia) => Number(dia.total) > 0) ? (
                <div
                  className="h-[260px] min-w-0"
                  aria-label="Gráfico de gastos de los últimos siete días"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={resumen.costos_por_dia}
                      margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="relleno-gastos"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#6b966e"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#6b966e"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="fecha"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#78857b" }}
                        tickFormatter={(valor) =>
                          new Intl.DateTimeFormat("es-MX", {
                            weekday: "short",
                            timeZone: "UTC",
                          }).format(new Date(String(valor)))
                        }
                      />
                      <YAxis
                        tickFormatter={(valor) =>
                          new Intl.NumberFormat("es-MX", {
                            style: "currency",
                            currency: "MXN",
                            maximumFractionDigits: 0,
                          }).format(Number(valor))
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#78857b" }}
                      />
                      <Tooltip
                        formatter={(valor) => [dinero(valor), "Gasto"]}
                        labelFormatter={(valor) => fechaLegible(valor)}
                        contentStyle={{
                          borderRadius: 14,
                          border: "1px solid #dfe8e0",
                        }}
                      />
                      <Area
                        isAnimationActive={false}
                        dataKey="total"
                        type="monotone"
                        stroke="#557f59"
                        strokeWidth={2}
                        fill="url(#relleno-gastos)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="estado-vacio h-[260px]">
                  <Activity size={25} />
                  <p>Aún no hay gastos registrados en este período.</p>
                  <Link href="/operaciones" className="boton-texto">
                    Consultar operaciones <ArrowUpRight size={15} />
                  </Link>
                </div>
              )}
            </article>
            <article className="tarjeta p-6">
              <div className="cabecera-seccion mt-0">
                <h2>Costos por categoría</h2>
                <Leaf size={19} />
              </div>
              {resumen.costos_por_categoria.length ? (
                <div className="space-y-5 mt-6">
                  {resumen.costos_por_categoria.map((categoria) => (
                    <div key={categoria.nombre}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>
                          {etiquetaValor(categoria.nombre, tiposOperacion)}
                        </span>
                        <strong>{dinero(categoria.total)}</strong>
                      </div>
                      <div className="barra-gasto">
                        <span
                          style={{
                            width:
                              Math.min(
                                100,
                                Number(resumen.totales.total)
                                  ? (Number(categoria.total) /
                                      Number(resumen.totales.total)) *
                                      100
                                  : 0,
                              ) + "%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="estado-vacio">
                  <p>No hay costos por categoría.</p>
                </div>
              )}
            </article>
          </section>
          <section className="rejilla-resumen">
            <article className="tarjeta p-6">
              <div className="cabecera-seccion mt-0">
                <h2>Actividad reciente</h2>
                <Link href="/operaciones" className="boton-texto">
                  Ver todas <ArrowUpRight size={15} />
                </Link>
              </div>
              {resumen.actividad_reciente.length ? (
                <div>
                  {resumen.actividad_reciente.map((operacion) => (
                    <div className="fila-actividad" key={operacion.id}>
                      <span className="icono-actividad">
                        <Leaf size={18} />
                      </span>
                      <div>
                        <strong>
                          {etiquetaValor(
                            operacion.tipo_operacion,
                            tiposOperacion,
                          )}
                        </strong>
                        <p>
                          {String(operacion.nombre_lote)} ·{" "}
                          {fechaLegible(operacion.fecha_operacion)}
                        </p>
                      </div>
                      <b>{dinero(operacion.costo_total)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="estado-vacio">
                  <p>No hay operaciones registradas.</p>
                  <Link className="boton-texto" href="/operaciones">
                    Registrar la primera operación
                  </Link>
                </div>
              )}
            </article>
            <article className="tarjeta p-6">
              <div className="cabecera-seccion mt-0">
                <h2>Costos por lote</h2>
                <Map size={19} />
              </div>
              {resumen.costos_por_lote.length ? (
                resumen.costos_por_lote.map((lote) => (
                  <div className="fila-actividad" key={lote.nombre}>
                    <div>
                      <strong>{lote.nombre}</strong>
                    </div>
                    <b>{dinero(lote.total)}</b>
                  </div>
                ))
              ) : (
                <div className="estado-vacio">
                  <p>No hay costos asignados a lotes.</p>
                </div>
              )}
              <div className="resumen-campo">
                <span>
                  <strong>{resumen.totales.mediciones}</strong> mediciones
                </span>
                <span>
                  <strong>{resumen.totales.operaciones}</strong> operaciones
                </span>
              </div>
            </article>
          </section>
          <section className="rejilla-indicadores tres-columnas">
            <Indicador
              titulo="Mano de obra"
              valor={dinero(resumen.totales.mano_obra)}
              descripcion="Tarifas capturadas por operación"
              icono={Users}
            />
            <Indicador
              titulo="Riego"
              valor={dinero(resumen.totales.riego)}
              descripcion="Duración y componentes registrados"
              icono={Droplets}
            />
            <Indicador
              titulo="Productos"
              valor={dinero(resumen.totales.productos)}
              descripcion="Precios preservados por aplicación"
              icono={Package}
            />
          </section>
        </>
      )}
    </>
  );
}
