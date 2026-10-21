-- ERP Agrícola Siempre Alcachofa.
-- Importación compatible con MySQL 8 / MariaDB 10.4+ (XAMPP).
-- No elimina ni modifica las tablas históricas. No crea personas ni datos de campo.
CREATE DATABASE IF NOT EXISTS `u374521469_bdcultivos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `u374521469_bdcultivos`;

CREATE TABLE IF NOT EXISTS roles (
  codigo VARCHAR(32) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS permisos (
  codigo VARCHAR(80) PRIMARY KEY,
  descripcion VARCHAR(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS roles_permisos (
  rol VARCHAR(32) NOT NULL,
  permiso VARCHAR(80) NOT NULL,
  PRIMARY KEY (rol, permiso),
  CONSTRAINT fk_roles_permisos_rol FOREIGN KEY (rol) REFERENCES roles(codigo),
  CONSTRAINT fk_roles_permisos_permiso FOREIGN KEY (permiso) REFERENCES permisos(codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO roles(codigo,nombre) VALUES ('admin','Administrador'),('encargado','Encargado'),('operador','Operador');
INSERT IGNORE INTO permisos(codigo,descripcion) VALUES
 ('usuarios.administrar','Administrar usuarios y accesos'),
 ('catalogos.consultar','Consultar catálogos'),('catalogos.escribir','Crear y editar catálogos'),
 ('catalogos.eliminar','Eliminar catálogos'),('operaciones.consultar','Consultar operaciones'),
 ('operaciones.crear','Capturar operaciones'),('operaciones.editar','Editar operaciones'),('operaciones.eliminar','Eliminar operaciones'),
 ('mediciones.consultar','Consultar mediciones'),('mediciones.crear','Capturar mediciones'),('mediciones.editar','Editar mediciones'),
 ('mediciones.eliminar','Eliminar mediciones'),('bitacora.consultar','Consultar bitácora'),('clima.consultar','Consultar meteorología');
INSERT IGNORE INTO roles_permisos(rol,permiso) SELECT 'admin',codigo FROM permisos;
INSERT IGNORE INTO roles_permisos(rol,permiso) SELECT 'encargado',codigo FROM permisos WHERE codigo IN ('catalogos.consultar','catalogos.escribir','operaciones.consultar','operaciones.crear','operaciones.editar','mediciones.consultar','mediciones.crear','mediciones.editar','clima.consultar');
INSERT IGNORE INTO roles_permisos(rol,permiso) SELECT 'operador',codigo FROM permisos WHERE codigo IN ('catalogos.consultar','operaciones.consultar','operaciones.crear','mediciones.consultar','mediciones.crear','clima.consultar');

CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(191) PRIMARY KEY,
  nombre VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NULL,
  rol ENUM('admin','encargado','operador') NOT NULL DEFAULT 'operador',
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_usuarios_email(email),
  KEY ix_usuarios_estado(estado,fecha_eliminacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sesiones (
  id CHAR(64) PRIMARY KEY,
  usuario_id VARCHAR(191) NOT NULL,
  fecha_expiracion DATETIME(3) NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_sesiones_usuario(usuario_id),
  KEY ix_sesiones_expiracion(fecha_expiracion),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS fincas (
  id VARCHAR(191) PRIMARY KEY,
  nombre VARCHAR(191) NOT NULL,
  ubicacion VARCHAR(191) NULL,
  latitud DECIMAL(10,7) NULL,
  longitud DECIMAL(10,7) NULL,
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS lotes (
  id VARCHAR(191) PRIMARY KEY,
  nombre_lote VARCHAR(191) NOT NULL,
  codigo VARCHAR(191) NOT NULL,
  superficie_ha DECIMAL(16,6) NOT NULL DEFAULT 0,
  unidad_superficie ENUM('hectarea','metro_cuadrado','acre') NOT NULL DEFAULT 'hectarea',
  superficie_original DECIMAL(12,4) NOT NULL DEFAULT 0,
  variedad VARCHAR(191) NULL,
  fecha_siembra DATE NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  ubicacion VARCHAR(191) NULL,
  latitud DECIMAL(10,7) NULL,
  longitud DECIMAL(10,7) NULL,
  centroide JSON NULL,
  geometria JSON NULL,
  notas TEXT NULL,
  lote_padre_id VARCHAR(191) NULL,
  finca_id VARCHAR(191) NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_lotes_codigo(codigo),
  KEY ix_lotes_estado(estado,fecha_eliminacion),
  KEY ix_lotes_coordenadas(latitud,longitud),
  CONSTRAINT fk_lotes_padre FOREIGN KEY (lote_padre_id) REFERENCES lotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_lotes_finca FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE RESTRICT,
  CONSTRAINT ck_lotes_superficie CHECK (superficie_ha >= 0 AND superficie_original >= 0),
  CONSTRAINT ck_lotes_latitud CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CONSTRAINT ck_lotes_longitud CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),
  CONSTRAINT ck_lotes_coordenadas CHECK ((latitud IS NULL) = (longitud IS NULL)),
  CONSTRAINT ck_lotes_padre_distinto CHECK (lote_padre_id IS NULL OR lote_padre_id <> id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS cultivos (
  id VARCHAR(191) PRIMARY KEY,
  nombre VARCHAR(191) NOT NULL,
  variedad VARCHAR(191) NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  descripcion TEXT NULL,
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_cultivos_nombre_variedad(nombre,variedad),
  KEY ix_cultivos_estado(estado,fecha_eliminacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS asignaciones_cultivo (
  id VARCHAR(191) PRIMARY KEY,
  lote_id VARCHAR(191) NOT NULL,
  cultivo_id VARCHAR(191) NOT NULL,
  fecha_inicio DATETIME(3) NOT NULL,
  fecha_fin DATETIME(3) NULL,
  superficie_original DECIMAL(12,4) NULL,
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ix_asignaciones_lote_fecha(lote_id,fecha_inicio,fecha_fin),
  KEY ix_asignaciones_cultivo_fecha(cultivo_id,fecha_inicio),
  CONSTRAINT fk_asignaciones_lote FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_asignaciones_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS empleados (
  id VARCHAR(191) PRIMARY KEY,
  nombre_completo VARCHAR(191) NOT NULL,
  tarifa_actual DECIMAL(12,2) NOT NULL,
  tipo_pago ENUM('hora','dia','jornal','semana','mes','otro') NOT NULL,
  unidad_pago VARCHAR(191) NOT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_contratacion DATETIME(3) NULL,
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  KEY ix_empleados_estado(estado,fecha_eliminacion),
  CONSTRAINT ck_empleados_tarifa CHECK (tarifa_actual >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS unidades (
  id VARCHAR(191) PRIMARY KEY,
  codigo VARCHAR(191) NOT NULL,
  nombre VARCHAR(191) NOT NULL,
  dimension VARCHAR(191) NOT NULL,
  es_base BOOLEAN NOT NULL DEFAULT FALSE,
  multiplicador DECIMAL(16,6) NOT NULL DEFAULT 1,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_unidades_codigo(codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS metodos_aplicacion (
  id VARCHAR(191) PRIMARY KEY,
  nombre VARCHAR(191) NOT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_metodos_nombre(nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS tipos_trabajo (
  id VARCHAR(191) PRIMARY KEY,
  nombre VARCHAR(191) NOT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_trabajos_nombre(nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS productos (
  id VARCHAR(191) PRIMARY KEY,
  codigo VARCHAR(191) NOT NULL,
  nombre VARCHAR(191) NOT NULL,
  categoria ENUM('fertilizante','fungicida','insecticida','herbicida','adyuvante','otro') NOT NULL,
  unidad_base VARCHAR(191) NOT NULL,
  precio_actual DECIMAL(12,4) NULL,
  proveedor VARCHAR(191) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  notas TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  UNIQUE KEY uq_productos_codigo(codigo),
  KEY ix_productos_categoria(categoria,activo,fecha_eliminacion),
  CONSTRAINT ck_productos_precio CHECK (precio_actual IS NULL OR precio_actual >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS historial_precios_productos (
  id VARCHAR(191) PRIMARY KEY,
  producto_id VARCHAR(191) NOT NULL,
  precio DECIMAL(12,4) NOT NULL,
  fecha_inicio DATETIME(3) NOT NULL,
  fecha_fin DATETIME(3) NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_precios_producto_fecha(producto_id,fecha_inicio,fecha_fin),
  CONSTRAINT fk_precios_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
  CONSTRAINT ck_precios_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS operaciones_campo (
  id VARCHAR(191) PRIMARY KEY,
  lote_id VARCHAR(191) NOT NULL,
  lote_original_id VARCHAR(191) NULL,
  tipo_operacion ENUM('riego','fertilizante','herbicida','practica_general','fumigacion','otro') NOT NULL,
  encargado_id VARCHAR(191) NULL,
  encargado_historico BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion TEXT NOT NULL,
  cantidad_dosificacion DECIMAL(14,4) NULL,
  unidad_dosificacion VARCHAR(32) NULL,
  fecha_operacion DATETIME(3) NOT NULL,
  observaciones TEXT NULL,
  estado ENUM('borrador','confirmada','pagada','pendiente_pago','cancelada') NOT NULL DEFAULT 'confirmada',
  tipo_fertilizante VARCHAR(191) NULL,
  cultivo_id VARCHAR(191) NULL,
  asignacion_cultivo_id VARCHAR(191) NULL,
  tipo_trabajo_id VARCHAR(191) NULL,
  metodo_id VARCHAR(191) NULL,
  costo_mano_obra DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_productos DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_aplicacion DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_riego DECIMAL(12,2) NOT NULL DEFAULT 0,
  otros_costos DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  KEY ix_operaciones_fecha_tipo(fecha_operacion,tipo_operacion,estado),
  KEY ix_operaciones_lote_fecha(lote_id,fecha_operacion),
  KEY ix_operaciones_encargado_fecha(encargado_id,fecha_operacion),
  KEY ix_operaciones_fertilizante(tipo_fertilizante),
  CONSTRAINT fk_operaciones_lote FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_lote_original FOREIGN KEY (lote_original_id) REFERENCES lotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_encargado FOREIGN KEY (encargado_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_cultivo FOREIGN KEY (cultivo_id) REFERENCES cultivos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_asignacion FOREIGN KEY (asignacion_cultivo_id) REFERENCES asignaciones_cultivo(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_trabajo FOREIGN KEY (tipo_trabajo_id) REFERENCES tipos_trabajo(id) ON DELETE RESTRICT,
  CONSTRAINT fk_operaciones_metodo FOREIGN KEY (metodo_id) REFERENCES metodos_aplicacion(id) ON DELETE RESTRICT,
  CONSTRAINT ck_operaciones_costos CHECK (costo_mano_obra >= 0 AND costo_productos >= 0 AND costo_aplicacion >= 0 AND costo_riego >= 0 AND otros_costos >= 0 AND costo_total >= 0),
  CONSTRAINT ck_operaciones_cantidad CHECK (cantidad_dosificacion IS NULL OR cantidad_dosificacion >= 0),
  CONSTRAINT ck_operaciones_encargado CHECK (encargado_id IS NOT NULL OR encargado_historico = TRUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS detalles_mano_obra (
  id VARCHAR(191) PRIMARY KEY,
  operacion_id VARCHAR(191) NOT NULL,
  empleado_id VARCHAR(191) NOT NULL,
  nombre_empleado VARCHAR(191) NOT NULL,
  tipo_pago ENUM('hora','dia','jornal','semana','mes','otro') NOT NULL,
  tarifa_capturada DECIMAL(12,2) NOT NULL,
  cantidad DECIMAL(12,4) NOT NULL DEFAULT 1,
  porcentaje_asignacion DECIMAL(5,2) NULL,
  costo_individual DECIMAL(12,2) NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_mano_obra_operacion(operacion_id),
  KEY ix_mano_obra_empleado(empleado_id),
  CONSTRAINT fk_mano_obra_operacion FOREIGN KEY (operacion_id) REFERENCES operaciones_campo(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mano_obra_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS aplicaciones_productos (
  id VARCHAR(191) PRIMARY KEY,
  operacion_id VARCHAR(191) NOT NULL,
  producto_id VARCHAR(191) NOT NULL,
  nombre_producto VARCHAR(191) NOT NULL,
  cantidad DECIMAL(14,4) NOT NULL,
  unidad VARCHAR(191) NOT NULL,
  precio_unitario DECIMAL(12,4) NOT NULL,
  costo_producto DECIMAL(12,2) NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_aplicaciones_operacion(operacion_id),
  KEY ix_aplicaciones_producto(producto_id),
  CONSTRAINT fk_aplicaciones_operacion FOREIGN KEY (operacion_id) REFERENCES operaciones_campo(id) ON DELETE RESTRICT,
  CONSTRAINT fk_aplicaciones_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS detalles_riego (
  id VARCHAR(191) PRIMARY KEY,
  operacion_id VARCHAR(191) NOT NULL,
  inicio DATETIME(3) NOT NULL,
  fin DATETIME(3) NOT NULL,
  duracion_horas DECIMAL(10,2) NOT NULL,
  tarifa_hora DECIMAL(12,4) NULL,
  costo_tarifa DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_agua DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_valvulas DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_operador DECIMAL(12,2) NOT NULL DEFAULT 0,
  otros_costos DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_riegos_operacion(operacion_id),
  CONSTRAINT fk_riegos_operacion FOREIGN KEY (operacion_id) REFERENCES operaciones_campo(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS mediciones_campo (
  id VARCHAR(191) PRIMARY KEY,
  lote_id VARCHAR(191) NOT NULL,
  usuario_id VARCHAR(191) NOT NULL,
  profundidad_cm DECIMAL(8,2) NOT NULL,
  humedad_porcentaje DECIMAL(5,2) NOT NULL,
  conductividad_ce DECIMAL(10,4) NOT NULL,
  ph_suelo DECIMAL(4,2) NOT NULL,
  fecha_hora DATETIME(3) NOT NULL,
  observaciones TEXT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  fecha_eliminacion DATETIME(3) NULL,
  KEY ix_mediciones_lote_fecha(lote_id,fecha_hora),
  KEY ix_mediciones_usuario(usuario_id,fecha_hora),
  CONSTRAINT fk_mediciones_lote FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mediciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_mediciones_profundidad CHECK (profundidad_cm BETWEEN 0 AND 1000),
  CONSTRAINT ck_mediciones_humedad CHECK (humedad_porcentaje BETWEEN 0 AND 100),
  CONSTRAINT ck_mediciones_conductividad CHECK (conductividad_ce BETWEEN 0 AND 1000),
  CONSTRAINT ck_mediciones_ph CHECK (ph_suelo BETWEEN 0 AND 14)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS cache_clima (
  id VARCHAR(191) PRIMARY KEY,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  tipo_consulta VARCHAR(191) NOT NULL,
  contenido JSON NOT NULL,
  expira_en DATETIME(3) NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  fecha_actualizacion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_clima_coordenadas_tipo(latitud,longitud,tipo_consulta),
  KEY ix_clima_expiracion(expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS bitacora_logs (
  id VARCHAR(191) PRIMARY KEY,
  usuario_id VARCHAR(191) NULL,
  accion VARCHAR(191) NOT NULL,
  modulo VARCHAR(80) NOT NULL,
  registro_id VARCHAR(191) NULL,
  detalles JSON NULL,
  ip VARCHAR(45) NULL,
  fecha_hora DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_bitacora_registro(modulo,registro_id),
  KEY ix_bitacora_usuario_fecha(usuario_id,fecha_hora),
  KEY ix_bitacora_fecha(fecha_hora),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS mapa_migracion (
  origen_base VARCHAR(64) NOT NULL,
  origen_tabla VARCHAR(64) NOT NULL,
  origen_id VARCHAR(191) NOT NULL,
  destino_tabla VARCHAR(64) NOT NULL,
  destino_id VARCHAR(191) NOT NULL,
  huella_origen CHAR(64) NOT NULL,
  fecha_migracion DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (origen_base,origen_tabla,origen_id),
  KEY ix_mapa_destino(destino_tabla,destino_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
