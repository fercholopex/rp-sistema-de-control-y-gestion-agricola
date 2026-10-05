"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  etiquetaAccion,
  etiquetaModulo,
  modulos,
  tiposOperacion,
  type Campo,
  type Opcion,
} from "@/cliente/src/configuracion/modulos";
import {
  fechaLegible,
  mensajeError,
  obtenerOpciones,
  solicitar,
  type Registro,
} from "@/cliente/src/servicios/http";
import { Aviso, Cabecera, Cargando, Ventana } from "@/components/elementos";
import {
  EntradaCampo,
  FormularioRegistro,
} from "@/components/formulario-registro";
import { useSesion } from "@/components/sesion";

const etiquetasDetalle: Record<string, string> = {
  id: "Identificador",
  usuario_id: "Usuario",
  lote_id: "Lote",
  encargado_id: "Encargado",
  cultivo_id: "Cultivo",
  lote_padre_id: "Lote de origen",
  finca_id: "Finca",
  email: "Correo electrónico",
  ip: "Dirección de conexión",
  centroide: "Centro geográfico",
  geometria: "Delimitación geográfica",
  datos_anteriores: "Información anterior",
  datos_nuevos: "Información actualizada",
};
const etiquetasValores: Record<string, string> = {
  admin: "Administrador",
  encargado: "Encargado",
  operador: "Operador",
  activo: "Activo",
  inactivo: "Inactivo",
  hectarea: "Hectáreas",
  metro_cuadrado: "Metros cuadrados",
  acre: "Acres",
  practica_general: "Prácticas",
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  pagada: "Pagada",
  cancelada: "Cancelada",
  borrador: "Borrador",
};
function nombreDetalle(clave: string) {
  return (
    etiquetasDetalle[clave] ??
    clave.replaceAll("_", " ").replace(/^./, (letra) => letra.toUpperCase())
  );
}

function ValorDetalle({ valor, clave }: { valor: unknown; clave: string }) {
  if (valor === null || valor === undefined || valor === "")
    return <span className="texto-ayuda">Sin registrar</span>;
  if (Array.isArray(valor))
    return valor.length ? (
      <div className="detalle-lista">
        {valor.map((elemento, indice) => (
          <div key={indice}>
            <ValorDetalle valor={elemento} clave={clave} />
          </div>
        ))}
      </div>
    ) : (
      <span className="texto-ayuda">Sin registros</span>
    );
  if (typeof valor === "object")
    return (
      <dl className="detalle-anidado">
        {Object.entries(valor)
          .filter(
            ([nombre]) =>
              !nombre.includes("hash") && !nombre.includes("contrasena"),
          )
          .map(([nombre, contenido]) => (
            <div key={nombre}>
              <dt>{nombreDetalle(nombre)}</dt>
              <dd>
                <ValorDetalle valor={contenido} clave={nombre} />
              </dd>
            </div>
          ))}
      </dl>
    );
  if (typeof valor === "boolean") return <>{valor ? "Sí" : "No"}</>;
  if (clave === "accion") return <>{etiquetaAccion(valor)}</>;
  if (clave === "modulo") return <>{etiquetaModulo(valor)}</>;
  if (clave.startsWith("fecha") || clave === "inicio" || clave === "fin")
    return (
      <>
        {fechaLegible(
          valor,
          clave !== "fecha_siembra" && clave !== "fecha_contratacion",
        )}
      </>
    );
  if (clave === "detalles" && typeof valor === "string") {
    let interpretado: unknown;
    try {
      interpretado = JSON.parse(valor);
    } catch {
      interpretado = valor;
    }
    if (typeof interpretado !== "string")
      return <ValorDetalle valor={interpretado} clave={clave} />;
  }
  return <>{etiquetasValores[String(valor)] ?? String(valor)}</>;
}

export function DetalleRegistro({ registro }: { registro: Registro }) {
  return (
    <dl className="detalle-registro">
      {Object.entries(registro)
        .filter(
          ([clave]) =>
            !clave.includes("hash") &&
            !clave.includes("contrasena") &&
            clave !== "fecha_eliminacion",
        )
        .map(([clave, valor]) => (
          <div
            key={clave}
            className={typeof valor === "object" ? "campo-ancho" : ""}
          >
            <dt>{nombreDetalle(clave)}</dt>
            <dd>
              <ValorDetalle valor={valor} clave={clave} />
            </dd>
          </div>
        ))}
    </dl>
  );
}

export function GestorRegistros({ recurso }: { recurso: string }) {
  const modulo = modulos[recurso];
  const usuario = useSesion();
  const [registros, asignarRegistros] = useState<Registro[]>([]);
  const [total, asignarTotal] = useState(0);
  const [pagina, asignarPagina] = useState(1);
  const [limite, asignarLimite] = useState(20);
  const [consultaCompletada, asignarConsultaCompletada] = useState("");
  const [error, asignarError] = useState("");
  const [aviso, asignarAviso] = useState("");
  const [buscar, asignarBuscar] = useState("");
  const [filtros, asignarFiltros] = useState<Record<string, string>>({});
  const [aplicados, asignarAplicados] = useState<Record<string, string>>({});
  const [opciones, asignarOpciones] = useState<Record<string, Opcion[]>>({});
  const [avanzados, asignarAvanzados] = useState(false);
  const [tipo, asignarTipo] = useState(() =>
    recurso === "operaciones" && typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("tipo_operacion") ??
        "")
      : "",
  );
  const [actualizacion, asignarActualizacion] = useState(0);
  const [formulario, asignarFormulario] = useState<{
    registro: Registro | null;
  } | null>(null);
  const [detalle, asignarDetalle] = useState<Registro | null>(null);
  const [eliminar, asignarEliminar] = useState<Registro | null>(null);
  const [procesando, asignarProcesando] = useState(false);
  const permitido = !modulo.administrador || usuario?.rol === "admin";
  const crear =
    permitido &&
    !modulo.soloLectura &&
    (usuario?.rol !== "operador" || modulo.capturaOperador);
  const editar =
    permitido && !modulo.soloLectura && usuario?.rol !== "operador";
  const quitar = permitido && !modulo.soloLectura && usuario?.rol === "admin";
  const claveConsulta = JSON.stringify([
    recurso,
    pagina,
    limite,
    aplicados,
    tipo,
    actualizacion,
  ]);
  const cargando = permitido && consultaCompletada !== claveConsulta;
  useEffect(() => {
    let vigente = true;
    Promise.all(
      (modulo.filtros ?? [])
        .filter((campo) => campo.origen)
        .map(
          async (campo) =>
            [
              campo.nombre,
              (await obtenerOpciones(campo.origen!)).map((fila) => ({
                valor: fila.id,
                etiqueta: String(fila[campo.etiquetaOrigen ?? "nombre"]),
              })),
            ] as const,
        ),
    )
      .then((resultado) => {
        if (vigente) asignarOpciones(Object.fromEntries(resultado));
      })
      .catch((fallo) => {
        if (vigente) asignarError(mensajeError(fallo));
      });
    return () => {
      vigente = false;
    };
  }, [modulo]);
  useEffect(() => {
    if (!permitido) return;
    let vigente = true;
    const parametros = new URLSearchParams({
      pagina: String(pagina),
      limite: String(limite),
      ...Object.fromEntries(
        Object.entries(aplicados).filter(([, valor]) => valor !== ""),
      ),
      ...(tipo ? { tipo_operacion: tipo } : {}),
    });
    solicitar<Registro[]>("/api/" + recurso + "?" + parametros)
      .then((respuesta) => {
        if (vigente) {
          asignarError("");
          asignarRegistros(respuesta.datos);
          asignarTotal(respuesta.total ?? respuesta.datos.length);
        }
      })
      .catch((fallo) => {
        if (vigente) {
          asignarError(mensajeError(fallo));
          asignarRegistros([]);
        }
      })
      .finally(() => {
        if (vigente) asignarConsultaCompletada(claveConsulta);
      });
    return () => {
      vigente = false;
    };
  }, [
    recurso,
    pagina,
    limite,
    aplicados,
    tipo,
    actualizacion,
    permitido,
    claveConsulta,
  ]);
  const verRegistro = useCallback(
    async (registro: Registro, edicion = false) => {
      asignarProcesando(true);
      asignarError("");
      try {
        const respuesta = await solicitar<Registro>(
          "/api/" + recurso + "/" + registro.id,
        );
        if (edicion) asignarFormulario({ registro: respuesta.datos });
        else asignarDetalle(respuesta.datos);
      } catch (fallo) {
        asignarError(mensajeError(fallo));
      } finally {
        asignarProcesando(false);
      }
    },
    [recurso],
  );
  const confirmarEliminacion = async () => {
    if (!eliminar) return;
    asignarProcesando(true);
    try {
      await solicitar("/api/" + recurso + "/" + eliminar.id, {
        method: "DELETE",
      });
      asignarEliminar(null);
      asignarAviso("Registro desactivado. Se conservó su historial.");
      asignarActualizacion((valor) => valor + 1);
    } catch (fallo) {
      asignarError(mensajeError(fallo));
      asignarEliminar(null);
    } finally {
      asignarProcesando(false);
    }
  };
  const aplicarFiltros = (evento: FormEvent) => {
    evento.preventDefault();
    asignarPagina(1);
    asignarAplicados({ ...filtros, buscar });
  };
  const camposFiltros: Campo[] = [
    ...(modulo.filtros ?? []),
    ...(["operaciones", "mediciones", "bitacora"].includes(recurso)
      ? [
          { nombre: "desde", etiqueta: "Desde", tipo: "date" as const },
          { nombre: "hasta", etiqueta: "Hasta", tipo: "date" as const },
        ]
      : []),
  ];
  if (!permitido)
    return (
      <>
        <Cabecera
          titulo={modulo.titulo}
          descripcion="Esta sección requiere acceso de administrador."
        />
        <Aviso
          error
          mensaje="No tienes permisos para consultar esta sección."
        />
      </>
    );
  return (
    <>
      <Cabecera
        titulo={modulo.titulo}
        descripcion={modulo.descripcion}
        acciones={
          crear && (
            <button
              type="button"
              className="boton"
              onClick={() => asignarFormulario({ registro: null })}
            >
              <Plus size={18} /> Agregar {modulo.singular}
            </button>
          )
        }
      />
      {error && <Aviso error mensaje={error} cerrar={() => asignarError("")} />}
      {aviso && <Aviso mensaje={aviso} cerrar={() => asignarAviso("")} />}
      {recurso === "operaciones" && (
        <div className="pestanas" aria-label="Categorías de operaciones">
          {[{ valor: "", etiqueta: "Todas" }, ...tiposOperacion].map(
            (opcion) => (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={tipo === opcion.valor}
                className={tipo === opcion.valor ? "pestana-activa" : ""}
                onClick={() => {
                  asignarTipo(opcion.valor);
                  asignarPagina(1);
                }}
              >
                {opcion.etiqueta}
              </button>
            ),
          )}
        </div>
      )}
      <section className="tarjeta tabla-tarjeta">
        <form onSubmit={aplicarFiltros} className="barra-filtros">
          <div className="fila-filtros">
            <label className="buscador">
              <Search size={18} />
              <input
                name="buscar"
                value={buscar}
                onChange={(evento) => asignarBuscar(evento.target.value)}
                placeholder="Buscar registros..."
                aria-label="Buscar registros"
              />
            </label>
            <button type="submit" className="boton-secundario">
              Buscar
            </button>
            {camposFiltros.length > 0 && (
              <button
                type="button"
                className="boton-secundario"
                aria-expanded={avanzados}
                onClick={() => asignarAvanzados(!avanzados)}
              >
                <Filter size={16} /> Filtros
              </button>
            )}
            <button
              type="button"
              className="boton-icono"
              aria-label="Actualizar registros"
              onClick={() => asignarActualizacion((valor) => valor + 1)}
              disabled={cargando}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          {avanzados && (
            <div className="filtros-avanzados">
              <div className="rejilla-filtros">
                {camposFiltros.map((campo) => (
                  <EntradaCampo
                    key={campo.nombre}
                    campo={campo}
                    requerido={false}
                    valor={filtros[campo.nombre]}
                    cambiar={(valor) =>
                      asignarFiltros((anterior) => ({
                        ...anterior,
                        [campo.nombre]: valor,
                      }))
                    }
                    opciones={opciones[campo.nombre]}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-3 mt-4">
                <button
                  type="button"
                  className="boton-texto"
                  onClick={() => {
                    asignarFiltros({});
                    asignarAplicados({});
                    asignarBuscar("");
                    asignarPagina(1);
                  }}
                >
                  Limpiar filtros
                </button>
                <button type="submit" className="boton">
                  Aplicar filtros
                </button>
              </div>
            </div>
          )}
        </form>
        {cargando ? (
          <Cargando />
        ) : error && registros.length === 0 ? (
          <div className="estado-vacio">
            <p>No se pudo cargar la información.</p>
            <button
              className="boton-secundario"
              onClick={() => asignarActualizacion((valor) => valor + 1)}
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          <div
            className="tabla-desplazable"
            tabIndex={0}
            role="region"
            aria-label={"Tabla de " + modulo.titulo.toLowerCase()}
          >
            <table>
              <thead>
                <tr>
                  {modulo.columnas.map((columna) => (
                    <th key={columna.nombre} scope="col">
                      {columna.etiqueta}
                    </th>
                  ))}
                  <th scope="col" className="text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {registros.length ? (
                  registros.map((registro) => (
                    <tr key={registro.id}>
                      {modulo.columnas.map((columna) => (
                        <td key={columna.nombre}>
                          {columna.mostrar
                            ? columna.mostrar(registro)
                            : String(registro[columna.nombre] ?? "—")}
                        </td>
                      ))}
                      <td>
                        <div className="acciones-tabla">
                          <button
                            type="button"
                            className="boton-icono"
                            title="Ver detalle"
                            aria-label="Ver detalle"
                            disabled={procesando}
                            onClick={() => void verRegistro(registro)}
                          >
                            <Eye size={17} />
                          </button>
                          {editar && (
                            <button
                              type="button"
                              className="boton-icono"
                              title="Editar"
                              aria-label="Editar"
                              disabled={procesando}
                              onClick={() => void verRegistro(registro, true)}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {quitar && (
                            <button
                              type="button"
                              className="boton-icono texto-peligro"
                              title="Desactivar"
                              aria-label="Desactivar"
                              disabled={procesando}
                              onClick={() => asignarEliminar(registro)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={modulo.columnas.length + 1}>
                      <div className="estado-vacio">
                        <SproutVacio />
                        <p>No hay registros con los filtros seleccionados.</p>
                        {crear && (
                          <button
                            type="button"
                            className="boton-texto"
                            onClick={() =>
                              asignarFormulario({ registro: null })
                            }
                          >
                            Agregar {modulo.singular}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <footer className="paginacion">
          <span>
            {total} registros · Página {pagina} de{" "}
            {Math.max(1, Math.ceil(total / limite))}
          </span>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={"limite-" + recurso}>
              Registros por página
            </label>
            <select
              id={"limite-" + recurso}
              className="campo ancho-auto"
              value={limite}
              onChange={(evento) => {
                asignarLimite(Number(evento.target.value));
                asignarPagina(1);
              }}
            >
              {[10, 20, 50].map((cantidad) => (
                <option key={cantidad} value={cantidad}>
                  {cantidad} por página
                </option>
              ))}
            </select>
            <button
              type="button"
              className="boton-icono"
              aria-label="Página anterior"
              disabled={pagina <= 1 || cargando}
              onClick={() => asignarPagina(pagina - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="boton-icono"
              aria-label="Página siguiente"
              disabled={pagina * limite >= total || cargando}
              onClick={() => asignarPagina(pagina + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>
      {formulario && (
        <Ventana
          titulo={
            (formulario.registro ? "Editar " : "Agregar ") + modulo.singular
          }
          cerrar={() => asignarFormulario(null)}
        >
          <FormularioRegistro
            modulo={modulo}
            registro={formulario.registro}
            cancelar={() => asignarFormulario(null)}
            completar={() => {
              asignarFormulario(null);
              asignarAviso("Información guardada correctamente.");
              asignarActualizacion((valor) => valor + 1);
            }}
          />
        </Ventana>
      )}
      {detalle && (
        <Ventana
          titulo={"Detalle de " + modulo.singular}
          cerrar={() => asignarDetalle(null)}
        >
          <DetalleRegistro registro={detalle} />
        </Ventana>
      )}
      {eliminar && (
        <Ventana
          titulo={"Desactivar " + modulo.singular}
          cerrar={() => {
            if (!procesando) asignarEliminar(null);
          }}
        >
          <div className="p-6">
            <p>
              {modulo.eliminacion ??
                "El registro dejará de estar disponible para nuevas capturas. Su información histórica se conservará."}
            </p>
            <p className="font-semibold mt-3">
              {String(
                (recurso === "operaciones"
                  ? eliminar.descripcion
                  : eliminar.nombre_lote) ??
                  eliminar.nombre ??
                  eliminar.nombre_completo ??
                  eliminar.descripcion ??
                  modulo.singular,
              )}
            </p>
            <div className="pie-formulario">
              <button
                className="boton-secundario"
                type="button"
                disabled={procesando}
                onClick={() => asignarEliminar(null)}
              >
                Cancelar
              </button>
              <button
                className="boton boton-peligro"
                type="button"
                disabled={procesando}
                onClick={() => void confirmarEliminacion()}
              >
                {procesando ? "Procesando..." : "Confirmar desactivación"}
              </button>
            </div>
          </div>
        </Ventana>
      )}
    </>
  );
}

function SproutVacio() {
  return <Search size={28} strokeWidth={1.5} aria-hidden="true" />;
}
