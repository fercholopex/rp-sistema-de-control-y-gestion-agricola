"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  CloudSun,
  Gauge,
  Leaf,
  LogOut,
  Map,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Sprout,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { nombreRol, ProtegerSesion, useSesion } from "@/components/sesion";
import { Aviso } from "@/components/elementos";
import { mensajeError, solicitar } from "@/cliente/src/servicios/http";

const enlaces: Array<{
  ruta: string;
  nombre: string;
  icono: LucideIcon;
  administrador?: boolean;
}> = [
  { ruta: "/", nombre: "Resumen", icono: Gauge },
  { ruta: "/lotes", nombre: "Lotes", icono: Map },
  { ruta: "/mediciones", nombre: "Mediciones de campo", icono: Activity },
  { ruta: "/operaciones", nombre: "Operaciones de campo", icono: Leaf },
  { ruta: "/clima", nombre: "Clima", icono: CloudSun },
  { ruta: "/cultivos", nombre: "Cultivos", icono: Sprout },
  { ruta: "/equipo", nombre: "Equipo de trabajo", icono: Users },
  { ruta: "/productos", nombre: "Productos", icono: Package },
  {
    ruta: "/usuarios",
    nombre: "Usuarios",
    icono: ShieldCheck,
    administrador: true,
  },
  {
    ruta: "/bitacora",
    nombre: "Bitácora",
    icono: BookOpen,
    administrador: true,
  },
  { ruta: "/configuracion", nombre: "Configuración", icono: Settings },
];

function Navegacion({ cerrar }: { cerrar?: () => void }) {
  const ruta = usePathname();
  const usuario = useSesion();
  return (
    <nav className="navegacion" aria-label="Navegación principal">
      {enlaces
        .filter((enlace) => !enlace.administrador || usuario?.rol === "admin")
        .map(({ ruta: destino, nombre, icono: Icono }) => (
          <Link
            key={destino}
            href={destino}
            onClick={cerrar}
            aria-current={ruta === destino ? "page" : undefined}
            className={ruta === destino ? "enlace-activo" : ""}
          >
            <Icono size={19} strokeWidth={1.8} />
            <span>{nombre}</span>
          </Link>
        ))}
    </nav>
  );
}

function Identidad() {
  return (
    <Link href="/" className="identidad">
      <span className="simbolo-marca">
        <Sprout size={25} />
      </span>
      <span>
        <strong>Siempre Alcachofa</strong>
        <small>ERP Agrícola</small>
      </span>
    </Link>
  );
}

function EstructuraInterior({ children }: { children: ReactNode }) {
  const usuario = useSesion();
  const navegador = useRouter();
  const ventana = useRef<HTMLDialogElement>(null);
  const inicioGesto = useRef(0);
  const [abierto, asignarAbierto] = useState(false);
  const [saliendo, asignarSaliendo] = useState(false);
  const [error, asignarError] = useState("");
  useEffect(() => {
    if (abierto) ventana.current?.showModal();
    else ventana.current?.close();
  }, [abierto]);
  const cerrarSesion = async () => {
    asignarSaliendo(true);
    try {
      await solicitar("/api/autenticacion/cerrar-sesion", { method: "POST" });
      navegador.replace("/iniciar-sesion");
    } catch (fallo) {
      asignarError(mensajeError(fallo));
      asignarSaliendo(false);
    }
  };
  const pie = (
    <div className="pie-navegacion">
      <div className="usuario-actual">
        <span>{usuario?.nombre.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{usuario?.nombre}</strong>
          <small>{nombreRol(usuario?.rol ?? "")}</small>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void cerrarSesion()}
        className="boton-salir"
        disabled={saliendo}
      >
        <LogOut size={17} />
        {saliendo ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
    </div>
  );
  return (
    <div>
      <aside className="menu-escritorio">
        <Identidad />
        <Navegacion />
        {pie}
      </aside>
      <header className="barra-movil">
        <button
          className="boton-icono"
          type="button"
          onClick={() => asignarAbierto(true)}
          aria-label="Abrir navegación"
          aria-expanded={abierto}
          aria-controls="menu-movil"
        >
          <Menu size={23} />
        </button>
        <Identidad />
      </header>
      <dialog
        id="menu-movil"
        ref={ventana}
        className="menu-movil"
        aria-label="Navegación"
        onCancel={() => asignarAbierto(false)}
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) asignarAbierto(false);
        }}
      >
        <aside
          onTouchStart={(evento) => {
            inicioGesto.current = evento.touches[0].clientX;
          }}
          onTouchEnd={(evento) => {
            if (inicioGesto.current - evento.changedTouches[0].clientX > 60)
              asignarAbierto(false);
          }}
        >
          <div className="flex items-center justify-between">
            <Identidad />
            <button
              type="button"
              className="boton-icono"
              aria-label="Cerrar navegación"
              onClick={() => asignarAbierto(false)}
            >
              <X size={20} />
            </button>
          </div>
          <Navegacion cerrar={() => asignarAbierto(false)} />
          {pie}
        </aside>
      </dialog>
      <main className="contenido-principal">
        <div className="contenedor-pagina">
          {error && (
            <Aviso error mensaje={error} cerrar={() => asignarError("")} />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

export function EstructuraAplicacion({ children }: { children: ReactNode }) {
  return (
    <ProtegerSesion>
      <EstructuraInterior>{children}</EstructuraInterior>
    </ProtegerSesion>
  );
}
