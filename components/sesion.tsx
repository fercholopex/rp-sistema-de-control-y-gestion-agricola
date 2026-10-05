"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ErrorSolicitud,
  mensajeError,
  solicitar,
} from "@/cliente/src/servicios/http";
import { Aviso, Cargando } from "@/components/elementos";

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "encargado" | "operador";
  estado: string;
};
const ContextoSesion = createContext<UsuarioSesion | null>(null);
export const useSesion = () => useContext(ContextoSesion);
export const nombreRol = (rol: string) =>
  ({ admin: "Administrador", encargado: "Encargado", operador: "Operador" })[
    rol
  ] ?? "Usuario";

export function ProtegerSesion({ children }: { children: ReactNode }) {
  const [usuario, asignarUsuario] = useState<UsuarioSesion | null>(null);
  const [error, asignarError] = useState("");
  const [intento, asignarIntento] = useState(0);
  const navegador = useRouter();
  useEffect(() => {
    let vigente = true;
    const comprobar = async () => {
      asignarError("");
      try {
        const estado = await solicitar<{ requiere_configuracion: boolean }>(
          "/api/autenticacion/estado",
        );
        if (estado.datos.requiere_configuracion) {
          navegador.replace("/setup");
          return;
        }
        const sesion = await solicitar<UsuarioSesion>(
          "/api/autenticacion/sesion",
        );
        if (vigente) asignarUsuario(sesion.datos);
      } catch (fallo) {
        if (fallo instanceof ErrorSolicitud && fallo.estado === 401)
          navegador.replace("/iniciar-sesion");
        else if (vigente) asignarError(mensajeError(fallo));
      }
    };
    void comprobar();
    const expirada = () => {
      asignarUsuario(null);
      navegador.replace("/iniciar-sesion?motivo=sesion-expirada");
    };
    window.addEventListener("sesion-expirada", expirada);
    return () => {
      vigente = false;
      window.removeEventListener("sesion-expirada", expirada);
    };
  }, [navegador, intento]);
  if (error)
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <Aviso error mensaje={error} />
        <button
          type="button"
          className="boton mt-4"
          onClick={() => asignarIntento(intento + 1)}
        >
          Volver a intentar
        </button>
      </main>
    );
  if (!usuario) return <Cargando texto="Comprobando acceso..." />;
  return (
    <ContextoSesion.Provider value={usuario}>
      {children}
    </ContextoSesion.Provider>
  );
}
