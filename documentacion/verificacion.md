# Verificación del ERP Agrícola Siempre Alcachofa

Registro de evidencia confirmada durante la sesión del 22 de septiembre de 2026. Entorno probado: Windows, Node.js 22.17.0 y MariaDB 10.4.32 de XAMPP. La compilación y el arranque local terminaron correctamente. No se realizó un despliegue público ni una ejecución independiente contra MySQL 8.

## Base de datos y migración

La ejecución de `npm run db:verificar` terminó correctamente contra `alcachofa_cultivos_db`, utilizando la cuenta restringida de la aplicación. Se verificaron las 23 tablas requeridas, sus columnas, relaciones, restricciones, índices y roles. No se encontraron tablas históricas en esa base; no había registros originales que importar allí.

La prueba real de `tests/migracion-integracion.ts` terminó con nueve escenarios aprobados en una base temporal exclusiva:

1. Impedir la copia de usuarios históricos antes de configurar al administrador inicial.
2. Copiar las 18 entidades originales y conservar sus correspondencias.
3. Conservar jerarquía de lotes, geometrías, unidades y códigos coincidentes sin fusionar registros.
4. Conservar costos, vínculos de auditoría y accesos históricos deshabilitados.
5. Verificar y repetir la migración sin duplicar datos.
6. Detectar cambios posteriores en el origen sin sobrescribir el destino.
7. Revertir toda la copia ante un fallo tardío, conservando la información original.
8. Detectar alteraciones de importes mediante comparación decimal.
9. Conservar las 39 claves foráneas del origen y del destino.

La base de esta prueba se eliminó al terminar. No se insertaron datos ficticios en la base de la aplicación. El SQL original limpio está conservado en `database/historico/estructura-anterior.sql`.

La creación de estructura y la migración requieren una cuenta instaladora con permisos DDL. La cuenta habitual de la aplicación permanece restringida y puede ejecutar la verificación de estructura en modo de lectura. Consultar los pasos y límites en [MIGRACION.md](../database/MIGRACION.md).

En la instalación local de MariaDB se detectaron daños previos en las tablas internas de permisos `mysql.db`, `mysql.columns_priv` y `mysql.procs_priv`. No se repararon ni se modificaron esas tablas compartidas. La cuenta de la aplicación funciona con permisos específicos por tabla mediante `mysql.tables_priv`; puede leer los catálogos técnicos, agregar y consultar la bitácora y gestionar las tablas operativas. La reparación administrativa de MariaDB sigue pendiente y no forma parte de los cambios realizados.

## Pruebas de la aplicación

La ejecución final de integración completó **82 comprobaciones aprobadas**. Incluyó solicitudes simultáneas a la configuración inicial, con respuestas **201** y **409**, confirmando que solo una creó al administrador; sesiones, roles, usuarios, catálogos, mediciones, operaciones, filtros, precios históricos y bitácora. La baja usa el mismo servicio HTTP del cliente para comprobar su contrato JSON con Express. La base temporal exclusiva se eliminó al finalizar.

`npm test` terminó con **36 pruebas aprobadas**, distribuidas así:

| Grupo                   | Archivo                             | Casos presentes |
| ----------------------- | ----------------------------------- | --------------: |
| Integridad del servidor | `tests/servidor-integridad.test.ts` |              15 |
| Seguridad del servidor  | `tests/servidor-seguridad.test.ts`  |               9 |
| Motor de costos         | `tests/motor-costos.test.ts`        |               5 |
| Fechas del cliente      | `tests/fechas-cliente.test.ts`      |               7 |
| **Total aprobado**      |                                     |          **36** |

`npm run test:fechas` también pasó en MariaDB real: operación, riego, medición, tres ediciones consecutivas sin desplazamiento, entrada con desplazamiento `-06:00`, límites de fechas locales y sesión de doce horas reales. Se corrigió la serialización local de objetos `Date` del conector usando parámetros SQL UTC explícitos. La base temporal de esta prueba se eliminó.

`npm run typecheck`, `npm run lint` y la compilación final `npm run build` terminaron sin errores. La compilación generó las 27 páginas previstas, incluidas las redirecciones de compatibilidad. Se comprobó el inicio de sesión y la edición de una operación usando `npm start` con la compilación de producción.

## Revisión en navegador

Se confirmó la revisión de la interfaz en las siguientes dimensiones:

| Presentación | Dimensiones |
| ------------ | ----------- |
| Escritorio   | 1440 × 1000 |
| Portátil     | 1366 × 768  |
| Móvil        | 390 × 844   |
| Tableta      | 768 × 1024  |

Durante la revisión funcional se comprobó la creación, consulta, edición y desactivación confirmada de una operación. El total fue **$520.00 MXN** y la edición conservó ese importe. Se capturó **08:30** y la consulta posterior mostró **08:30 de Ciudad de México**. Se verificaron filtros de categorías, baja con actualización de la tabla a cero registros, registro de desactivación en la bitácora y cierre de sesión. También se confirmó una consulta meteorológica real a Open-Meteo.

La revisión documentada acredita esos recorridos y dimensiones concretos. No implica una comprobación exhaustiva de todas las combinaciones de filtros, permisos o tamaños posibles.

## Configuración y dependencias

`ZONA_HORARIA` es configurable y utiliza `America/Mexico_City` como valor predeterminado. Los instantes se almacenan en UTC; las capturas, la presentación y los períodos contables utilizan la zona configurada. Las fechas sin hora conservan su día de calendario. Esta configuración está documentada en el README y en la guía de migración.

La revisión de dependencias mediante `npm audit` informó **cero vulnerabilidades** en la ejecución confirmada. Este resultado corresponde al árbol de dependencias revisado en ese momento.

El puerto 3000 estaba ocupado por una aplicación de otra carpeta cuyo nombre termina en `- copia`. Este proyecto quedó iniciado en **http://localhost:3100**, con `PUERTO` y `ORIGEN_FRONTEND` coherentes entre sí.

## Estado de entrega

- Se retiró la base temporal utilizada en el navegador y su archivo local de credenciales.
- La cuenta restringida confirmó **cero usuarios, lotes, operaciones y mediciones** en la base definitiva.
- La apertura del sistema redirige a `/setup` y muestra el formulario de **Administrador principal**, verificado visualmente.
- El usuario debe crear su primera cuenta desde esa pantalla; no se fabricó un administrador.

La reparación de las tablas internas de MariaDB descrita arriba queda fuera de esta entrega. La publicación requiere configurar el dominio definitivo y HTTPS según el README.
