# ERP Agrícola Siempre Alcachofa

Sistema de gestión de campo en español. Conserva la aplicación React y Next.js existente, incorpora Express como servidor de datos y utiliza MySQL/MariaDB mediante consultas parametrizadas. No hay datos de demostración en la instalación.

## Requisitos

- Node.js 22 o posterior y npm.
- MariaDB 10.4 o posterior (incluida en XAMPP), o MySQL 8.0.16 o posterior.
- Acceso a una base de datos y permisos para crear sus tablas durante la instalación.
- Conexión a Internet únicamente para instalar dependencias y consultar el proveedor meteorológico.

## Instalación y XAMPP

1. Iniciar MySQL desde XAMPP. Apache solo es necesario para utilizar phpMyAdmin.
2. Crear la cuenta local de la aplicación con permisos sobre `alcachofa_cultivos_db` exclusivamente. La configuración solicitada utiliza `us-alcachofacultivos` y contraseña vacía; no se inventa una contraseña. Una instalación pública debe utilizar credenciales propias de su entorno.
3. Copiar `.env.example` a `.env` y completar `DB_USER` y las demás variables. `.env` está excluido del control de versiones.
4. Instalar las dependencias:

```powershell
npm install
```

5. Importar `database/schema_migration.sql` con una cuenta instaladora que pueda crear tablas y relaciones. Puede hacerse directamente en phpMyAdmin, pestaña **Importar**, o mediante el cliente MySQL:

```text
mysql -h localhost -P 3306 -u cuenta_instaladora -p
source database/schema_migration.sql
```

El archivo crea y selecciona la base, utiliza InnoDB y utf8mb4, define relaciones, índices y restricciones, y agrega únicamente roles y permisos técnicos. No crea usuarios ni registros de campo.

La opción `-p` solicita la contraseña de la cuenta instaladora; se omite cuando esa cuenta tiene una contraseña vacía. La cuenta habitual de la aplicación tiene permisos restringidos y no necesita crear ni eliminar tablas. Como alternativa a la importación manual, `npm run db:migrate` aplica la estructura y migra los datos históricos, utilizando credenciales de instalador configuradas temporalmente en el proceso. No sustituir permanentemente la cuenta restringida del `.env` por una cuenta administrativa.

6. Con la cuenta habitual configurada en `.env`, comprobar la estructura:

```powershell
npm run db:verificar
```

## Configuración

| Variable                 | Uso                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `DB_HOST`, `DB_PORT`     | Dirección y puerto de MySQL/MariaDB                                                                |
| `DB_NAME`                | Base de datos de destino                                                                           |
| `DB_USER`, `DB_PASSWORD` | Cuenta de acceso; se admite contraseña vacía configurada explícitamente                            |
| `DB_ORIGEN`              | Opcional: base histórica en la misma instancia para migrar registros                               |
| `PUERTO`, `HOST_ESCUCHA` | Puerto e interfaz del servidor web                                                                 |
| `ORIGEN_FRONTEND`        | Origen exacto autorizado, incluyendo protocolo y puerto                                            |
| `SESION_HORAS`           | Caducidad absoluta de la sesión                                                                    |
| `CONFIAR_PROXY`          | Opcional: `1` solamente cuando un proxy de confianza es el único punto de entrada                  |
| `ZONA_HORARIA`           | Zona del sistema para captura, visualización y períodos contables; `America/Mexico_City` por defecto |
| `CLIMA_URL`              | Dirección del servicio de pronóstico compatible con Open-Meteo                                     |

Se utilizan sesiones persistidas; no se requiere un secreto JWT. React consume rutas relativas del mismo origen, por lo que no se requiere una variable `VITE_API_URL` ni un segundo servidor web. Se conserva Next.js para evitar reconstruir el proyecto con Vite.

Los instantes se almacenan en UTC. La captura, la visualización y los límites de día, semana y mes utilizan `ZONA_HORARIA`, cuyo valor predeterminado es `America/Mexico_City`. Las fechas de calendario, como la fecha de siembra, conservan su día sin desplazarse por una conversión horaria.

Después de cambiar la zona horaria, reiniciar el proceso y volver a compilar la interfaz para producción.

## Ejecución

```powershell
npm run dev
```

Este comando inicia Express y la interfaz Next.js en el mismo proceso y puerto. Abrir el origen definido en `.env`. Sin usuarios, la aplicación dirige a `/setup`, donde se crea el administrador principal. Después de guardar, se cierra la configuración inicial y se inicia sesión con esa cuenta.

```powershell
npm run build
npm start
```

En producción, publicar detrás de HTTPS y configurar `ORIGEN_FRONTEND` con el dominio definitivo. Las cookies de producción requieren HTTPS. Mantener MySQL fuera del acceso público, ejecutar con una cuenta de servicio y programar copias de seguridad. No desplegar con `next start`: el punto de entrada del sistema es `servidor/iniciar.ts`. Esta arquitectura necesita un proceso Node.js persistente y no utiliza la salida autónoma de Next.js.

## Estructura

```text
app/                    Páginas, diseños y estilos de la interfaz existente
cliente/src/            Acceso HTTP y componentes de la interfaz en español
components/             Componentes compartidos de React
servidor/iniciar.ts      Inicio conjunto de Express y Next.js
servidor/src/            Rutas, servicios, seguridad y conexión a MySQL
lib/servicios/           Motor de costos conservado y traducido
database/               Esquema SQL, migración e historial de la estructura original
tests/                  Pruebas de costos, seguridad e integración
```

## Acceso y permisos

Las contraseñas se derivan con scrypt y sal aleatoria. El navegador recibe una cookie HttpOnly; la base almacena únicamente el resumen del identificador de sesión. Las sesiones caducan y el servidor comprueba que el usuario siga activo en cada solicitud. Las mutaciones requieren verificación de origen, contenido JSON y una cabecera de seguridad enviada por el cliente.

| Rol visible   | Alcance                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Administrador | Administración completa, usuarios, eliminaciones y bitácora                    |
| Encargado     | Consulta y gestión de catálogos, mediciones y operaciones según permisos       |
| Operador      | Consulta y captura de mediciones y operaciones; sin administración de usuarios |

La eliminación de registros de campo conserva su historial mediante fecha de eliminación. Las modificaciones y su bitácora se guardan dentro de la misma transacción. No se entregan hashes de contraseña al navegador. Las operaciones de usuarios protegen al último administrador activo.

## Módulos

- Resumen económico: totales, semana, mes, tendencia, categorías, lotes y actividad reciente.
- Lotes: superficie, unidades de origen, coordenadas, geometrías, variedad y fecha de siembra.
- Cultivos, equipo y productos: catálogos originales, tarifas e historial de precios.
- Mediciones: profundidad, humedad, conductividad y pH con validación de rangos y relaciones.
- Operaciones: riegos, fertilizantes, herbicidas y prácticas, encargado obligatorio, costos y filtros del servidor.
- Usuarios: roles, activación, desactivación y cambio de contraseña.
- Bitácora: consulta de acciones atribuida al usuario y fecha, sin edición desde la aplicación.
- Clima: temperatura, humedad, radiación y evapotranspiración para las coordenadas del lote. Los valores proceden del proveedor configurado; los estados de error o ausencia no se reemplazan por datos inventados. [Documentación del proveedor](https://open-meteo.com/en/docs).

## Migración y conservación de datos

Respaldar la base original antes de cualquier migración. El esquema antiguo se conserva como referencia histórica. La migración copia a tablas españolas sin eliminar las tablas de origen, registra los identificadores equivalentes y comprueba las relaciones. La [guía de migración](database/MIGRACION.md) describe los permisos de instalación y los casos históricos que requieren revisión humana, incluidos usuarios sin contraseña y operaciones sin encargado. Si existen usuarios históricos, crear primero el administrador desde `/setup` antes de copiar esos registros.

```powershell
npm run db:migrate
npm run db:verificar
```

El comando de migración requiere la cuenta instaladora; el de verificación admite la cuenta restringida. No ejecutar el antiguo generador de datos de demostración. `npm run db:seed` crea únicamente estructura y catálogos técnicos, y también requiere permisos de instalación.

## Verificación

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Las pruebas de integración utilizan una base independiente y datos temporales exclusivos de pruebas. No deben ejecutarse contra una base de producción. Los resultados de validación del entorno se documentan en `documentacion/verificacion.md`.

La cuenta de pruebas necesita crear y eliminar bases temporales. Sus credenciales se configuran solo para el proceso de pruebas:

```powershell
$env:DB_PRUEBAS_USUARIO = "cuenta_de_pruebas"
$env:DB_PRUEBAS_PASSWORD = ""
npm run test:integracion
npm run test:migracion
npm run test:fechas
```

Cada ejecución utiliza un nombre de base exclusivo y elimina únicamente su propia base al terminar. La opción `--conservar` del guion de integración está reservada para revisión visual local: deja la base temporal identificada en `tmp/pruebas-interfaz.json` hasta completar esa revisión. Nunca agrega datos de prueba a `alcachofa_cultivos_db`.
