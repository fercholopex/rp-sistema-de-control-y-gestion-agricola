# Migración de datos de Siempre Alcachofa

El esquema español se crea con `schema_migration.sql`. Es compatible con MySQL 8 y MariaDB 10.4 o posterior, incluidos los paquetes XAMPP que utilicen esas versiones. El archivo incluye `CREATE DATABASE IF NOT EXISTS` y `USE alcachofa_cultivos_db`, y se puede importar desde phpMyAdmin. No contiene contraseñas, personas, lotes de demostración ni operaciones ficticias.

En MySQL se requiere la versión 8.0.16 o posterior para que las restricciones `CHECK` se apliquen. La versión de MariaDB debe ser 10.4 o posterior, conforme a los requisitos del proyecto.

La herramienta `migrar.ts` aplica ese archivo y copia los datos del esquema histórico cuando lo encuentra. Usa el conector MariaDB directamente, sin Prisma ni su cliente generado. La cuenta que ejecuta la instalación debe disponer de permisos de creación de tablas y relaciones; la cuenta habitual del servicio puede limitarse después a consultar y modificar datos. `DB_USER` y `DB_PASSWORD` pueden establecerse temporalmente en la sesión del instalador sin cambiar el `.env` de la aplicación. No otorgue privilegios de creación o eliminación de tablas a la cuenta de uso habitual para ejecutar la aplicación.

## Antes de importar

1. Detener las escrituras en el sistema anterior y conservar un respaldo verificable de toda la base, incluyendo estructura, disparadores y datos. Exportarlo con phpMyAdmin o `mysqldump` utilizando credenciales fuera de la línea de comandos. No guardar respaldos que contengan datos personales en el repositorio.
2. Registrar la versión del motor, la base de origen, los recuentos de tablas y las sumas de costos. Verificar que el respaldo se puede restaurar en una base de prueba.
3. Configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`. Una contraseña vacía se respeta: no se sustituye por otra. Las credenciales no se imprimen.
4. Si los datos originales están en otra base del mismo servidor, definir `DB_ORIGEN`. La cuenta necesita permiso de lectura sobre esa base. Si se omite, la herramienta busca las tablas históricas en `DB_NAME`.
5. Ejecutar primero en una copia restaurada. Resolver los registros inválidos o conflictos de claves con el responsable de datos antes de migrar la base de trabajo.

Si la fuente contiene usuarios históricos, crear primero el esquema con `--solo-esquema`, iniciar la aplicación y crear el administrador desde `/setup`, usando un correo diferente de los usuarios históricos. La migración comprueba esta condición y se detiene antes de copiar cuando la tabla de usuarios está vacía. El asistente permanece disponible únicamente mientras `usuarios = 0`; los usuarios heredados nunca abren un nuevo acceso público de configuración.

## Ejecución

```powershell
# Crear únicamente las tablas españolas y la configuración técnica.
npx tsx database/migrar.ts --solo-esquema

# Crear el esquema y copiar datos históricos presentes.
npx tsx database/migrar.ts

# Comprobar la importación sin modificar datos de las tablas.
npx tsx database/migrar.ts --verificar
```

`--verificar` también comprueba las 23 tablas, columnas, claves foráneas, restricciones, índices y roles cuando no existen tablas históricas. Puede utilizar la cuenta restringida de la aplicación: las definiciones se consultan con `SHOW CREATE TABLE`, ya que MariaDB limita cierta información de `information_schema` para cuentas de solo lectura.

Los nombres de bases aceptan únicamente letras, números y guion bajo. Los datos se envían mediante parámetros SQL. El archivo SQL importable usa la base solicitada `alcachofa_cultivos_db`; el ejecutor sustituye de forma controlada ese identificador por `DB_NAME` para permitir entornos de pruebas.

La creación del esquema es una fase independiente: MySQL y MariaDB confirman implícitamente muchas operaciones de estructura. Después, toda la copia de datos y su mapa se realizan dentro de una única transacción con claves foráneas activas. Un fallo de datos revierte la copia completa, aunque las tablas vacías creadas anteriormente permanezcan. Ninguna sentencia elimina ni actualiza las tablas originales.

## Correspondencia de las 18 entidades originales

| Origen histórico     | Destino                     | Tratamiento                                                                 |
| -------------------- | --------------------------- | --------------------------------------------------------------------------- |
| User                 | usuarios                    | Identidad y rol conservados; acceso inactivo hasta asignar contraseña.      |
| Farm                 | fincas                      | Ubicación y coordenadas conservadas.                                        |
| Lot                  | lotes                       | Lote principal con geometría, unidad y superficie originales.               |
| Parcel               | lotes                       | Lote con `lote_padre_id`; desaparece la entidad duplicada en la aplicación. |
| Crop                 | cultivos                    | Variedad, notas, estados y bajas conservados.                               |
| CropAssignment       | asignaciones_cultivo        | Relación con el lote convertido, cultivo y vigencia originales.             |
| Employee             | empleados                   | Tarifa vigente y forma de pago conservadas.                                 |
| Unit                 | unidades                    | Magnitud y conversión conservadas.                                          |
| ApplicationMethod    | metodos_aplicacion          | Catálogo conservado.                                                        |
| WorkType             | tipos_trabajo               | Catálogo conservado.                                                        |
| Product              | productos                   | Unidad, precio, categoría y proveedor conservados.                          |
| ProductPriceHistory  | historial_precios_productos | Todos los períodos y precios históricos conservados.                        |
| AgriculturalActivity | operaciones_campo           | Estados, cultivos, métodos y costos conservados.                            |
| LaborEntry           | detalles_mano_obra          | Nombre y tarifa capturada conservados; no se recalculan.                    |
| ProductApplication   | aplicaciones_productos      | Nombre, dosis y precio capturado conservados; no se recalculan.             |
| IrrigationDetail     | detalles_riego              | Intervalo, duración e importes originales conservados.                      |
| WeatherCache         | cache_clima                 | Respuestas originales y caducidad conservadas.                              |
| AuditLog             | bitacora_logs               | Antes/después y referencias originales conservados dentro de los detalles.  |

Las tablas de sesiones, mediciones, roles y permisos son nuevas. Solo los tres roles y sus permisos iniciales reciben registros técnicos durante la instalación.

## Decisiones de conservación

- Los identificadores nuevos son UUID deterministas derivados de base, tabla e identificador original. `mapa_migracion` conserva la correspondencia, una huella del registro y la fecha de importación. No se confunden identificadores iguales de entidades diferentes.
- Un código de lote que colisiona recibe un sufijo estable `-MIG-…`; el valor original queda conservado en la tabla fuente. Cualquier otra colisión de clave única detiene y revierte la copia en lugar de fusionar personas o productos arbitrariamente.
- La superficie se convierte a hectáreas mediante aritmética entera y se redondea a seis decimales. `superficie_original` y `unidad_superficie` conservan la medida capturada. Las geometrías y centroides se copian sin inventar coordenadas.
- Las fechas históricas se copian sin alterar su valor. La aplicación guarda los nuevos instantes en UTC y usa `ZONA_HORARIA` para capturas, visualización y períodos contables; el valor predeterminado es `America/Mexico_City`. Si una base externa almacenó fechas antiguas como hora local, se debe documentar esa convención y acordar su conversión antes de importar: el migrador no adivina una zona ni desplaza fechas históricas automáticamente.
- Las actividades relacionadas con la antigua división apuntan al lote convertido; `lote_original_id` conserva adicionalmente la relación con el lote principal de la actividad. Las asignaciones mantienen su lote y cultivo.
- Los usuarios antiguos carecían de contraseña. Se importan con hash nulo e inactivos; no se inventa ni distribuye ninguna contraseña. El administrador inicial se crea antes de copiarlos, desde `/setup`, con la tabla de usuarios vacía. Posteriormente, ese administrador asigna las contraseñas mediante el módulo de usuarios.
- El origen no contiene encargado de actividad. Las operaciones históricas usan `encargado_historico = 1` y encargado nulo, sin atribuir acciones a una persona ficticia. La aplicación exige un encargado válido para nuevas capturas y al regularizar una operación histórica.
- Los importes se copian como valores decimales, sin recalcular con precios o tarifas actuales. La verificación compara cada importe y cada cantidad de las cinco tablas de costos, incluidos nulos, mediante SQL decimal.
- La bitácora mantiene los datos originales antes/después. Esas instantáneas históricas pueden contener nombres ingleses porque modificarlas destruiría evidencia; los módulos activos emplean español.

## Repetición, informes y verificación

Una ejecución posterior omite los registros ya mapeados cuando la huella de origen y el destino siguen presentes. Si se modifica o elimina información en el origen después de migrar, o desaparece un destino, la herramienta se detiene. No sobrescribe cambios actuales con datos antiguos. No es una sincronización continua entre dos sistemas.

Cada ejecución completada con datos históricos genera un informe JSON en `database/informes/`, con base, fecha, tabla de origen/destino, cantidad de origen, cantidad nueva y cantidad previamente migrada. Los informes no incluyen nombres de personas, contraseñas ni filas de negocio. Conservar estos informes junto al respaldo fuera del repositorio cuando contengan información de infraestructura sensible.

Verificaciones automáticas:

1. Correspondencia de los recuentos originales con el mapa de migración.
2. Existencia de cada registro de destino mapeado.
3. Huella original sin cambios entre ejecuciones.
4. Claves foráneas y restricciones activas durante toda la copia.
5. Comparación decimal por registro de costos, precios, tarifas, cantidades y porcentajes históricos.
6. Reversión completa de la copia ante cualquier diferencia.

Después de la primera importación, revisar muestras de lotes y geometrías, las fechas, notas e instantáneas de auditoría; comprobar inicio de sesión, permisos, catálogos y operaciones desde la aplicación. No eliminar las tablas de origen hasta que exista una aceptación expresa y un respaldo restaurable. La herramienta nunca las elimina.

Si ya se editaron importes de operaciones migradas en el sistema nuevo, `--verificar` informará una diferencia frente al origen. Conservar el informe inicial y revisar esos cambios con la bitácora; no volver a importar ni sustituir la información actual automáticamente.

## Recuperación

Si falla la copia, solucionar primero el acceso, la restricción o la relación de origen indicada; luego repetir. El proceso no usa `INSERT IGNORE` para registros del negocio. Si se requiere volver al sistema anterior, detener nuevas escrituras y usar las tablas o el respaldo originales, que se conservaron. Cualquier dato creado después del cambio de sistema necesita conciliación explícita antes de regresar al anterior.

## Estado de verificación

El 22 de septiembre de 2026 se ejecutó la prueba real `tests/migracion-integracion.ts` contra MariaDB de XAMPP. Pasaron nueve escenarios: guardia del administrador inicial; copia de las 18 entidades; jerarquía/geometría/unidades/códigos; costos y auditoría; repetición sin duplicados; detección de origen modificado; reversión completa ante un importe inválido; detección de alteraciones de importes; y conservación de 39 claves foráneas entre origen y destino. La base exclusiva de prueba se eliminó al terminar. No se cargaron datos ficticios en la base de la aplicación.

La verificación de la base `alcachofa_cultivos_db` con la cuenta restringida solicitada también terminó correctamente: 23 tablas requeridas, relaciones, restricciones, índices y roles presentes. No se encontraron tablas históricas en esa base y, por tanto, no había datos originales que copiar allí. Este resultado no sustituye la importación futura de otras bases que el propietario pueda aportar.

Para repetir la prueba en una instalación de desarrollo, configurar la conexión normal y una cuenta instaladora mediante `DB_PRUEBAS_USUARIO` y `DB_PRUEBAS_PASSWORD`; después ejecutar:

```powershell
npx tsx tests/migracion-integracion.ts
```

La prueba crea una base con prefijo `alcachofa_prueba_migracion_` y sufijo aleatorio, comprueba el patrón completo antes de eliminarla y nunca utiliza `DB_NAME` como destino de las filas de prueba. El SQL histórico limpio utilizado está en `database/historico/estructura-anterior.sql`.
