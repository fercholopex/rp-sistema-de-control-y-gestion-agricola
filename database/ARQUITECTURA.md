# Mapa de arquitectura y conservación

## Inspección previa

El proyecto original era una aplicación React 19 con Next.js 16, rutas del servidor integradas, Prisma 7 y el adaptador MariaDB. La información persistente se obtenía exclusivamente de MySQL. No se encontró persistencia de negocio en el navegador ni una base de datos embebida.

Los catálogos de lotes, divisiones de lotes, cultivos, empleados y productos ya permitían altas, consultas, cambios y bajas lógicas mediante servicios y validación Zod. Los productos conservaban historial de precios. El resumen obtenía costos por categoría, lote, día, semana y mes a partir de actividades reales. El motor de costos calculaba mano de obra individual, productos, riego y componentes de actividad; las pruebas protegían tarifas capturadas y evitaban sumar componentes dos veces.

Las páginas de prácticas, riegos, fertilización, herbicidas, meteorología y configuración eran avisos de fase pendiente. Las tablas de operaciones y sus detalles ya existían en el esquema, pero no había rutas para escribirlos desde esas páginas. No había autenticación, contraseña, sesión, control de permisos ni mediciones de campo. La bitácora de catálogos se escribía después de la modificación, fuera de su transacción, y sin usuario o dirección de red.

El esquema original contiene 18 tablas, siete enumeraciones y 16 relaciones con eliminación restringida. El archivo histórico y su migración inicial se conservan como referencia. La semilla anterior incluía empleados, productos y diez lotes de ejemplo, y actualizaba ciertos valores existentes; no debe ejecutarse en el sistema evolucionado.

## Organización resultante

La aplicación mantiene React y los componentes reutilizables existentes. El servidor Express concentra autenticación, autorización, validación y consultas parametrizadas con el conector MariaDB. Las rutas españolas conectan directamente con las tablas españolas del esquema compartido. La presentación no contiene credenciales ni decisiones de permisos como único control.

```text
React: navegación, formularios, listas, filtros y resumen
                         ↓ solicitudes con sesión
Express: autenticación → permisos → validación → servicios
                         ↓ consultas parametrizadas / transacciones
MySQL o MariaDB: catálogos, operaciones, mediciones y bitácora
```

La organización exacta de archivos de ejecución está documentada en el README del proyecto. Esta evolución conserva el motor de costos, los campos avanzados de catálogos, las bajas lógicas y el historial financiero. La migración traduce las entidades existentes sin reemplazarlas por tablas de demostración.

## Relaciones principales

```text
fincas → lotes → lotes hijos
cultivos → asignaciones_cultivo ← lotes
usuarios → sesiones
usuarios → mediciones_campo ← lotes
usuarios → operaciones_campo ← lotes / cultivos / asignaciones
operaciones_campo → detalles_mano_obra ← empleados
operaciones_campo → aplicaciones_productos ← productos
operaciones_campo → detalles_riego
productos → historial_precios_productos
usuarios → bitacora_logs
roles → roles_permisos ← permisos
```

`mapa_migracion` vincula las 18 entidades originales con sus destinos y permite repetir la importación sin duplicar registros. `cache_clima` conserva respuestas reales de la fuente configurada. `mediciones_campo` impone límites de humedad, profundidad, conductividad y pH, además de relaciones obligatorias con lote y usuario.

## Riesgos detectados y medidas

| Hallazgo original                                     | Medida de evolución                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Dos entidades de campo con relaciones diferentes      | Unificar en lotes jerárquicos y conservar referencia original de operaciones.                  |
| Usuarios sin contraseña                               | Importar inactivos y habilitar mediante contraseña segura; no fabricar credenciales.           |
| Ausencia de encargado en operaciones históricas       | Marcar explícitamente como histórico; responsable obligatorio en capturas nuevas.              |
| Tarifas y precios cambiantes                          | Conservar instantáneas de mano de obra/productos y períodos de precios.                        |
| Semilla con datos de ejemplo                          | Instalar únicamente roles y permisos técnicos.                                                 |
| Auditoría fuera de la transacción                     | Escribir cambios y bitácora dentro de la misma transacción del servidor.                       |
| Códigos potencialmente coincidentes al unificar campo | Asignar sufijo determinista y conservar correspondencia; no fusionar registros.                |
| Fechas y unidades de superficie                       | Conservar unidades originales y fechas; convertir superficie sin aritmética binaria imprecisa. |
| Fallos de conexión o integridad                       | Detener importación, revertir datos y conservar todas las tablas originales.                   |

Las referencias inglesas del esquema histórico y del migrador son identificadores de origen necesarios para recuperar datos existentes. No forman parte de los nombres activos de las tablas, rutas, módulos o mensajes de la aplicación.
