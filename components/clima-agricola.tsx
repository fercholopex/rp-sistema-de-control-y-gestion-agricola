"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  RefreshCw,
  Moon,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import {
  fechaLegible,
  mensajeError,
  obtenerOpciones,
  solicitar,
  type Registro,
} from "@/cliente/src/servicios/http";
import { Aviso, Cabecera, Cargando } from "@/components/elementos";

type Clima = {
  lote_id: string;
  nombre_lote: string;
  fuente: string;
  actualizado_en: string;
  actual: {
    fecha_hora: string;
    temperatura: number | null;
    humedad_ambiental: number | null;
    radiacion_solar: number | null;
    evapotranspiracion: number | null;
    codigo_clima: number | null;
    velocidad_viento: number | null;
    es_dia: boolean | null;
  };
  pronostico: Array<{
    fecha: string;
    temperatura_maxima: number;
    temperatura_minima: number;
    precipitacion: number;
    evapotranspiracion: number;
    codigo_clima: number;
  }>;
};
function estadoClima(codigo: number | null) {
  return codigo === null
    ? "Sin información"
    : codigo === 0
      ? "Despejado"
      : codigo <= 3
        ? "Parcialmente nublado"
        : codigo < 50
          ? "Niebla"
          : codigo < 70 || codigo >= 80
            ? "Lluvia"
            : "Nieve";
}
const lectura = (valor: number | null | undefined, unidad: string) =>
  valor == null
    ? "Sin información"
    : Number(valor).toLocaleString("es-MX", { maximumFractionDigits: 2 }) +
      " " +
      unidad;

function EscenaClima({
  codigo,
  viento,
  esDia,
}: {
  codigo: number | null;
  viento: number | null;
  esDia: boolean | null;
}) {
  const reducir = useReducedMotion();
  const IconoLuz = esDia === false ? Moon : Sun;
  const lluvia =
    codigo !== null && ((codigo >= 50 && codigo < 70) || codigo >= 80);
  const nubes = codigo !== null && codigo > 0;
  return (
    <div className="escena-clima" aria-hidden="true">
      <motion.div
        className="sol-clima"
        animate={reducir ? {} : { y: [0, -6, 0], scale: [1, 1.035, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <IconoLuz size={78} strokeWidth={1.3} />
      </motion.div>
      {nubes && (
        <motion.div
          className="nube-clima"
          animate={reducir ? {} : { x: [-8, 12, -8] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        >
          <Cloud size={90} strokeWidth={1.25} />
        </motion.div>
      )}
      {lluvia && (
        <div className="lluvia-clima">
          {[0, 1, 2, 3, 4].map((indice) => (
            <motion.span
              key={indice}
              animate={reducir ? {} : { y: [0, 22], opacity: [0, 0.65, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: indice * 0.28,
              }}
            />
          ))}
        </div>
      )}
      {Number(viento) > 15 && (
        <motion.div
          className="viento-clima"
          animate={reducir ? {} : { x: [-4, 7, -4] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Wind size={40} />
        </motion.div>
      )}
    </div>
  );
}

export function ClimaAgricola() {
  const [lotes, asignarLotes] = useState<Registro[]>([]);
  const [lote, asignarLote] = useState("");
  const [datos, asignarDatos] = useState<Clima | null>(null);
  const [error, asignarError] = useState("");
  const [cargando, asignarCargando] = useState(true);
  const [actualizacion, asignarActualizacion] = useState(0);
  const [listo, asignarListo] = useState(false);
  useEffect(() => {
    let vigente = true;
    obtenerOpciones("/api/lotes?estado=activo")
      .then((registros) => {
        if (vigente) {
          asignarLotes(registros);
          const primero = registros.find(
            (registro) => registro.latitud != null && registro.longitud != null,
          );
          asignarLote(primero?.id ?? registros[0]?.id ?? "");
          asignarListo(true);
          if (!registros.length) asignarCargando(false);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          asignarError(mensajeError(fallo));
          asignarCargando(false);
        }
      });
    return () => {
      vigente = false;
    };
  }, []);
  useEffect(() => {
    if (!lote) return;
    let vigente = true;
    solicitar<Clima>("/api/clima?" + new URLSearchParams({ lote_id: lote }))
      .then((respuesta) => {
        if (vigente) asignarDatos(respuesta.datos);
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
  }, [lote, actualizacion]);
  return (
    <>
      <Cabecera
        titulo="Clima del campo"
        descripcion="Condiciones y pronóstico de la ubicación registrada en cada lote."
        acciones={
          <button
            type="button"
            className="boton-secundario"
            disabled={!lote || cargando}
            onClick={() => {
              asignarCargando(true);
              asignarError("");
              asignarDatos(null);
              asignarActualizacion(actualizacion + 1);
            }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        }
      />
      <section className="tarjeta p-5 mb-5">
        <label className="etiqueta max-w-md">
          Lote
          <select
            className="campo"
            value={lote}
            onChange={(evento) => {
              asignarCargando(Boolean(evento.target.value));
              asignarError("");
              asignarDatos(null);
              asignarLote(evento.target.value);
            }}
          >
            <option value="">Seleccionar lote</option>
            {lotes.map((registro) => (
              <option key={registro.id} value={registro.id}>
                {String(registro.nombre_lote)}
                {registro.latitud == null ? " · Sin coordenadas" : ""}
              </option>
            ))}
          </select>
        </label>
      </section>
      {error && <Aviso error mensaje={error} />}
      {cargando ? (
        <Cargando texto="Consultando información meteorológica..." />
      ) : datos ? (
        <>
          <section className="tarjeta clima-principal">
            <div>
              <p className="sobre-titulo">{datos.nombre_lote}</p>
              <h2>{estadoClima(datos.actual.codigo_clima)}</h2>
              <strong className="temperatura-principal">
                {lectura(datos.actual.temperatura, "°C")}
              </strong>
              <p className="texto-ayuda">
                Medición: {fechaLegible(datos.actual.fecha_hora, true)}
              </p>
            </div>
            <EscenaClima
              codigo={datos.actual.codigo_clima}
              viento={datos.actual.velocidad_viento}
              esDia={datos.actual.es_dia}
            />
          </section>
          <section className="rejilla-indicadores mt-5">
            {[
              {
                titulo: "Temperatura",
                valor: datos.actual.temperatura,
                unidad: "°C",
                Icono: Thermometer,
              },
              {
                titulo: "Humedad ambiental",
                valor: datos.actual.humedad_ambiental,
                unidad: "%",
                Icono: Droplets,
              },
              {
                titulo: "Radiación solar",
                valor: datos.actual.radiacion_solar,
                unidad: "W/m²",
                Icono: Sun,
              },
              {
                titulo: "Evapotranspiración",
                valor: datos.actual.evapotranspiracion,
                unidad: "mm",
                Icono: Waves,
              },
            ].map(({ titulo, valor, unidad, Icono }) => (
              <article key={titulo} className="tarjeta indicador">
                <div>
                  <p>{titulo}</p>
                  <Icono size={20} />
                </div>
                <strong className={valor == null ? "text-base" : ""}>
                  {lectura(valor, unidad)}
                </strong>
                <small>Dato de la fuente meteorológica</small>
              </article>
            ))}
          </section>
          <section className="tarjeta p-6 mt-5">
            <div className="cabecera-seccion mt-0">
              <h2>Pronóstico</h2>
              <span className="texto-ayuda">
                <Wind size={15} className="inline" />{" "}
                {lectura(datos.actual.velocidad_viento, "km/h")}
              </span>
            </div>
            <div className="pronostico">
              {datos.pronostico.map((dia) => (
                <article key={dia.fecha}>
                  <p>{fechaLegible(dia.fecha)}</p>
                  {dia.codigo_clima >= 50 ? (
                    <CloudRain size={29} />
                  ) : dia.codigo_clima > 0 ? (
                    <CloudSun size={29} />
                  ) : (
                    <Sun size={29} />
                  )}
                  <strong>{lectura(dia.temperatura_maxima, "°C")}</strong>
                  <span>{lectura(dia.temperatura_minima, "°C")}</span>
                  <small>Lluvia: {lectura(dia.precipitacion, "mm")}</small>
                  <small>
                    Evapotranspiración: {lectura(dia.evapotranspiracion, "mm")}
                  </small>
                </article>
              ))}
            </div>
          </section>
          <p className="texto-ayuda mt-4">
            Fuente: {datos.fuente} · Actualizado:{" "}
            {fechaLegible(datos.actualizado_en, true)}
          </p>
        </>
      ) : (
        !error &&
        listo && (
          <div className="tarjeta estado-vacio">
            <CloudSun size={32} />
            <p>
              {lotes.length
                ? "Selecciona un lote para consultar su clima."
                : "Registra un lote con coordenadas para consultar el clima."}
            </p>
          </div>
        )
      )}
    </>
  );
}
