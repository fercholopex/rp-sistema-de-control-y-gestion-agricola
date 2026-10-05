"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { Aviso, Cargando } from "@/components/elementos";
import { mensajeError, solicitar } from "@/cliente/src/servicios/http";

export function FormularioAcceso({
  configuracion = false,
}: {
  configuracion?: boolean;
}) {
  const navegador = useRouter();
  const [listo, asignarListo] = useState(false);
  const [error, asignarError] = useState("");
  const [aviso, asignarAviso] = useState("");
  const [guardando, asignarGuardando] = useState(false);
  const [visible, asignarVisible] = useState(false);
  useEffect(() => {
    const comprobar = async () => {
      try {
        const respuesta = await solicitar<{ requiere_configuracion: boolean }>(
          "/api/autenticacion/estado",
        );
        if (respuesta.datos.requiere_configuracion !== configuracion) {
          navegador.replace(
            respuesta.datos.requiere_configuracion
              ? "/setup"
              : "/iniciar-sesion",
          );
          return;
        }
        const motivo = new URLSearchParams(window.location.search).get(
          "motivo",
        );
        if (motivo === "sesion-expirada")
          asignarAviso(
            "Tu sesión finalizó. Inicia sesión nuevamente para continuar.",
          );
        if (motivo === "cuenta-creada")
          asignarAviso(
            "La cuenta de administrador se creó correctamente. Ya puedes iniciar sesión.",
          );
        asignarListo(true);
      } catch (fallo) {
        asignarError(mensajeError(fallo));
      }
    };
    void comprobar();
  }, [configuracion, navegador]);
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const contrasena = String(formulario.get("contrasena"));
    if (configuracion && contrasena !== formulario.get("confirmacion")) {
      asignarError("Las contraseñas no coinciden.");
      return;
    }
    asignarGuardando(true);
    asignarError("");
    try {
      await solicitar(
        "/api/autenticacion/" + (configuracion ? "setup" : "iniciar-sesion"),
        {
          method: "POST",
          body: JSON.stringify({
            ...(configuracion ? { nombre: formulario.get("nombre") } : {}),
            email: formulario.get("email"),
            contrasena,
          }),
        },
      );
      navegador.replace(
        configuracion ? "/iniciar-sesion?motivo=cuenta-creada" : "/",
      );
    } catch (fallo) {
      asignarError(mensajeError(fallo));
      asignarGuardando(false);
    }
  };
  return (
    <main className="pagina-acceso">
      <section className="presentacion-acceso">
        <div className="flex items-center gap-3">
          <Sprout size={34} />
          <strong>ERP Agrícola Siempre Alcachofa</strong>
        </div>
        <div>
          <p className="sobre-titulo">DEL CAMPO A LA DECISIÓN</p>
          <h1>
            Información clara.
            <br />
            Un campo mejor cuidado.
          </h1>
          <p>
            Lotes, mediciones y operaciones conectados para acompañar cada
            jornada de trabajo.
          </p>
          <div className="sello-acceso">
            <Leaf size={18} /> Gestión agrícola con trazabilidad
          </div>
        </div>
        <small>Tu información, protegida en cada paso.</small>
      </section>
      <section className="tarjeta-acceso">
        <ShieldCheck size={31} className="text-[#456b49]" />
        <p className="sobre-titulo mt-5">SIEMPRE ALCACHOFA</p>
        <h2>
          {configuracion ? "Administrador principal" : "Bienvenido de nuevo"}
        </h2>
        <p className="descripcion-pagina mb-6">
          {configuracion
            ? "Crea la primera cuenta para comenzar. Esta configuración se habilita una sola vez."
            : "Inicia sesión para consultar y gestionar tu campo."}
        </p>
        {error && <Aviso error mensaje={error} />}
        {aviso && <Aviso mensaje={aviso} />}
        {!listo ? (
          error ? (
            <button
              type="button"
              className="boton mt-4"
              onClick={() => window.location.reload()}
            >
              Volver a intentar
            </button>
          ) : (
            <Cargando texto="Comprobando configuración..." />
          )
        ) : (
          <form onSubmit={enviar} className="space-y-5">
            {configuracion && (
              <label className="etiqueta">
                Nombre completo
                <input
                  className="campo"
                  name="nombre"
                  required
                  minLength={3}
                  maxLength={160}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="etiqueta">
              Correo electrónico
              <input
                className="campo"
                name="email"
                type="email"
                required
                maxLength={191}
                autoComplete="username"
              />
            </label>
            <label className="etiqueta">
              Contraseña
              <div className="relative">
                <input
                  className="campo pr-12"
                  name="contrasena"
                  type={visible ? "text" : "password"}
                  required
                  minLength={configuracion ? 12 : 1}
                  maxLength={128}
                  autoComplete={
                    configuracion ? "new-password" : "current-password"
                  }
                />
                <button
                  className="absolute right-2 top-2 boton-icono"
                  type="button"
                  onClick={() => asignarVisible(!visible)}
                  aria-label={
                    visible ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {configuracion && <small>Usa al menos 12 caracteres.</small>}
            </label>
            {configuracion && (
              <label className="etiqueta">
                Confirmar contraseña
                <input
                  className="campo"
                  name="confirmacion"
                  type={visible ? "text" : "password"}
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
            )}
            <button className="boton w-full" disabled={guardando} type="submit">
              {guardando ? (
                <LoaderCircle size={18} className="animacion-carga" />
              ) : (
                <ArrowRight size={18} />
              )}
              {guardando
                ? "Procesando..."
                : configuracion
                  ? "Crear administrador"
                  : "Iniciar sesión"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
