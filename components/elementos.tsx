"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";

export function Cargando({
  texto = "Cargando información...",
}: {
  texto?: string;
}) {
  return (
    <div className="estado-vacio" role="status">
      <LoaderCircle className="animacion-carga" size={25} />
      <p>{texto}</p>
    </div>
  );
}

export function Aviso({
  mensaje,
  error = false,
  cerrar,
}: {
  mensaje: string;
  error?: boolean;
  cerrar?: () => void;
}) {
  return (
    <div
      className={"aviso " + (error ? "aviso-error" : "")}
      role={error ? "alert" : "status"}
    >
      <AlertCircle size={18} className="shrink-0" />
      <span className="flex-1">{mensaje}</span>
      {cerrar && (
        <button
          type="button"
          className="boton-icono"
          onClick={cerrar}
          aria-label="Cerrar aviso"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Cabecera({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="cabecera-pagina">
      <div>
        <p className="sobre-titulo">SIEMPRE ALCACHOFA</p>
        <h1>{titulo}</h1>
        <p className="descripcion-pagina">{descripcion}</p>
      </div>
      {acciones}
    </header>
  );
}

export function Ventana({
  titulo,
  children,
  cerrar,
}: {
  titulo: string;
  children: ReactNode;
  cerrar: () => void;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const identificador = useId();
  useEffect(() => {
    const ventana = referencia.current;
    const anterior = document.activeElement as HTMLElement | null;
    ventana?.showModal();
    return () => {
      ventana?.close();
      anterior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={referencia}
      className="ventana"
      aria-labelledby={identificador}
      onCancel={(evento) => {
        evento.preventDefault();
        cerrar();
      }}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <section className="ventana-contenido">
        <header className="ventana-cabecera">
          <h2 id={identificador}>{titulo}</h2>
          <button
            className="boton-icono"
            type="button"
            onClick={cerrar}
            aria-label="Cerrar ventana"
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}
