"use client";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Cabecera } from "@/components/elementos";
import { nombreRol, useSesion } from "@/components/sesion";
import { zonaHoraria } from "@/cliente/src/servicios/http";

export function ConfiguracionSistema() {
  const usuario = useSesion();
  return (
    <>
      <Cabecera
        titulo="Configuración"
        descripcion="Identidad del sistema y datos de tu cuenta actual."
      />
      <div className="rejilla-resumen">
        <section className="tarjeta p-6">
          <ShieldCheck className="mb-4 text-[#547a58]" size={26} />
          <h2>Tu cuenta</h2>
          <dl className="detalle-registro px-0 pb-0">
            <div>
              <dt>Nombre</dt>
              <dd>{usuario?.nombre}</dd>
            </div>
            <div>
              <dt>Correo electrónico</dt>
              <dd>{usuario?.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{nombreRol(usuario?.rol ?? "")}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>
                <CheckCircle2 size={15} className="inline mr-2" />
                Activo
              </dd>
            </div>
          </dl>
        </section>
        <section className="tarjeta p-6">
          <h2>ERP Agrícola Siempre Alcachofa</h2>
          <p className="descripcion-pagina">
            Gestión de lotes, mediciones y operaciones agrícolas con historial
            de costos y trazabilidad.
          </p>
          <dl className="detalle-registro px-0 pb-0">
            <div>
              <dt>Idioma</dt>
              <dd>Español</dd>
            </div>
            <div>
              <dt>Moneda</dt>
              <dd>Peso mexicano (MXN)</dd>
            </div>
            <div>
              <dt>Zona horaria de consulta</dt>
              <dd>{zonaHoraria.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Meteorología</dt>
              <dd>Open-Meteo, por ubicación del lote</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
