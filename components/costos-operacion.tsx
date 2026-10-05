"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  dinero,
  mensajeError,
  obtenerOpciones,
  type Registro,
} from "@/cliente/src/servicios/http";
import { Aviso } from "@/components/elementos";

type Trabajo = {
  empleado_id: string;
  cantidad: number;
  porcentaje_asignacion?: number;
  tarifa_capturada?: number;
  tipo_pago?: string;
  unidad_pago?: string;
};
type Insumo = {
  producto_id: string;
  cantidad: number;
  precio_unitario?: number;
  unidad?: string;
};
type Riego = {
  inicio: string;
  fin: string;
  tarifa_hora: number;
  costo_agua: number;
  costo_valvulas: number;
  costo_operador: number;
  otros_costos: number;
};
export type ComponentesOperacion = {
  mano_obra: Trabajo[];
  productos: Insumo[];
  riego: Riego | null;
};
const riegoVacio: Riego = {
  inicio: "",
  fin: "",
  tarifa_hora: 0,
  costo_agua: 0,
  costo_valvulas: 0,
  costo_operador: 0,
  otros_costos: 0,
};

export function DetalleCostosOperacion({
  valores,
  cambiar,
  esRiego,
}: {
  valores: ComponentesOperacion;
  cambiar: (valores: ComponentesOperacion) => void;
  esRiego: boolean;
}) {
  const [empleados, asignarEmpleados] = useState<Registro[]>([]);
  const [productos, asignarProductos] = useState<Registro[]>([]);
  const [error, asignarError] = useState("");
  useEffect(() => {
    let vigente = true;
    Promise.all([
      obtenerOpciones("/api/empleados?estado=activo"),
      obtenerOpciones("/api/productos"),
    ])
      .then(([equipo, insumos]) => {
        if (vigente) {
          asignarEmpleados(equipo);
          asignarProductos(insumos.filter((producto) => producto.activo));
        }
      })
      .catch((fallo) => {
        if (vigente) asignarError(mensajeError(fallo));
      });
    return () => {
      vigente = false;
    };
  }, []);
  const riego = valores.riego ?? riegoVacio;
  return (
    <section className="costos-formulario">
      <h3>Detalle de costos</h3>
      <p className="texto-ayuda">
        Los importes se calculan al guardar. Las tarifas y precios utilizados
        quedan registrados en la operación.
      </p>
      {error && <Aviso error mensaje={error} />}
      <div className="cabecera-seccion">
        <h4>Mano de obra</h4>
        <button
          type="button"
          className="boton-texto"
          onClick={() =>
            cambiar({
              ...valores,
              mano_obra: [
                ...valores.mano_obra,
                { empleado_id: "", cantidad: 1 },
              ],
            })
          }
        >
          <Plus size={16} /> Agregar empleado
        </button>
      </div>
      {valores.mano_obra.map((trabajo, indice) => (
        <div className="fila-costo" key={indice}>
          <label className="etiqueta">
            Empleado
            <select
              className="campo"
              required
              value={trabajo.empleado_id}
              onChange={(evento) =>
                cambiar({
                  ...valores,
                  mano_obra: valores.mano_obra.map((fila, posicion) =>
                    posicion === indice
                      ? {
                          ...fila,
                          empleado_id: evento.target.value,
                          tarifa_capturada: undefined,
                        }
                      : fila,
                  ),
                })
              }
            >
              <option value="">Seleccionar...</option>
              {empleados.map((empleado) => (
                <option key={empleado.id} value={empleado.id}>
                  {String(empleado.nombre_completo)} ·{" "}
                  {dinero(empleado.tarifa_actual)} /{" "}
                  {String(empleado.unidad_pago)}
                </option>
              ))}
              {trabajo.empleado_id &&
                !empleados.some(
                  (empleado) => empleado.id === trabajo.empleado_id,
                ) && (
                  <option value={trabajo.empleado_id}>
                    Empleado histórico
                  </option>
                )}
            </select>
            {trabajo.tarifa_capturada != null && (
              <small>
                Tarifa capturada: {dinero(trabajo.tarifa_capturada)} /{" "}
                {trabajo.unidad_pago ?? trabajo.tipo_pago ?? "unidad"}. El
                selector muestra la tarifa vigente.
              </small>
            )}
          </label>
          <label className="etiqueta">
            Cantidad de unidades
            <input
              type="number"
              min={0.000001}
              step="any"
              required
              className="campo"
              value={trabajo.cantidad}
              onChange={(evento) =>
                cambiar({
                  ...valores,
                  mano_obra: valores.mano_obra.map((fila, posicion) =>
                    posicion === indice
                      ? { ...fila, cantidad: Number(evento.target.value) }
                      : fila,
                  ),
                })
              }
            />
          </label>
          <label className="etiqueta">
            Asignación (%)
            <input
              type="number"
              min={0.01}
              max={100}
              step="any"
              className="campo"
              value={trabajo.porcentaje_asignacion ?? ""}
              onChange={(evento) =>
                cambiar({
                  ...valores,
                  mano_obra: valores.mano_obra.map((fila, posicion) =>
                    posicion === indice
                      ? {
                          ...fila,
                          porcentaje_asignacion:
                            evento.target.value === ""
                              ? undefined
                              : Number(evento.target.value),
                        }
                      : fila,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="boton-icono texto-peligro"
            aria-label="Quitar empleado"
            onClick={() =>
              cambiar({
                ...valores,
                mano_obra: valores.mano_obra.filter(
                  (_, posicion) => posicion !== indice,
                ),
              })
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      {valores.mano_obra.length === 0 && (
        <p className="texto-ayuda">Sin mano de obra agregada.</p>
      )}
      <div className="cabecera-seccion">
        <h4>Productos aplicados</h4>
        <button
          type="button"
          className="boton-texto"
          onClick={() =>
            cambiar({
              ...valores,
              productos: [
                ...valores.productos,
                { producto_id: "", cantidad: 1 },
              ],
            })
          }
        >
          <Plus size={16} /> Agregar producto
        </button>
      </div>
      {valores.productos.map((insumo, indice) => (
        <div className="fila-costo fila-insumo" key={indice}>
          <label className="etiqueta">
            Producto
            <select
              className="campo"
              required
              value={insumo.producto_id}
              onChange={(evento) =>
                cambiar({
                  ...valores,
                  productos: valores.productos.map((fila, posicion) =>
                    posicion === indice
                      ? {
                          ...fila,
                          producto_id: evento.target.value,
                          precio_unitario: undefined,
                        }
                      : fila,
                  ),
                })
              }
            >
              <option value="">Seleccionar...</option>
              {productos.map((producto) => (
                <option
                  key={producto.id}
                  value={producto.id}
                  disabled={producto.precio_actual === null}
                >
                  {String(producto.nombre)} ·{" "}
                  {producto.precio_actual === null
                    ? "Sin precio"
                    : dinero(producto.precio_actual)}{" "}
                  / {String(producto.unidad_base)}
                </option>
              ))}
              {insumo.producto_id &&
                !productos.some(
                  (producto) => producto.id === insumo.producto_id,
                ) && (
                  <option value={insumo.producto_id}>Producto histórico</option>
                )}
            </select>
            {insumo.precio_unitario != null && (
              <small>
                Precio capturado: {dinero(insumo.precio_unitario)} /{" "}
                {insumo.unidad ?? "unidad"}. El selector muestra el precio
                vigente.
              </small>
            )}
          </label>
          <label className="etiqueta">
            Cantidad (unidad base)
            <input
              type="number"
              className="campo"
              min={0.000001}
              step="any"
              required
              value={insumo.cantidad}
              onChange={(evento) =>
                cambiar({
                  ...valores,
                  productos: valores.productos.map((fila, posicion) =>
                    posicion === indice
                      ? { ...fila, cantidad: Number(evento.target.value) }
                      : fila,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="boton-icono texto-peligro"
            aria-label="Quitar producto"
            onClick={() =>
              cambiar({
                ...valores,
                productos: valores.productos.filter(
                  (_, posicion) => posicion !== indice,
                ),
              })
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      {valores.productos.length === 0 && (
        <p className="texto-ayuda">Sin productos agregados.</p>
      )}
      {esRiego && (
        <>
          <div className="cabecera-seccion">
            <h4>Duración y costo de riego</h4>
          </div>
          <div className="rejilla-formulario">
            {(
              [
                ["inicio", "Inicio del riego"],
                ["fin", "Fin del riego"],
              ] as const
            ).map(([campo, etiqueta]) => (
              <label key={campo} className="etiqueta">
                {etiqueta}
                <input
                  className="campo"
                  type="datetime-local"
                  required
                  value={riego[campo]}
                  onChange={(evento) =>
                    cambiar({
                      ...valores,
                      riego: { ...riego, [campo]: evento.target.value },
                    })
                  }
                />
              </label>
            ))}
            {(
              [
                ["tarifa_hora", "Tarifa por hora (MXN)"],
                ["costo_agua", "Agua (MXN)"],
                ["costo_valvulas", "Válvulas (MXN)"],
                ["costo_operador", "Operador (MXN)"],
                ["otros_costos", "Otros costos del riego (MXN)"],
              ] as const
            ).map(([campo, etiqueta]) => (
              <label key={campo} className="etiqueta">
                {etiqueta}
                <input
                  className="campo"
                  type="number"
                  min={0}
                  step="any"
                  value={riego[campo]}
                  onChange={(evento) =>
                    cambiar({
                      ...valores,
                      riego: { ...riego, [campo]: Number(evento.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
