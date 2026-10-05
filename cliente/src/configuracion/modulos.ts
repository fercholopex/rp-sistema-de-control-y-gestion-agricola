import {
  dinero,
  fechaLegible,
  type Registro,
} from "@/cliente/src/servicios/http";

export type Opcion = { valor: string; etiqueta: string };
export type Campo = {
  nombre: string;
  etiqueta: string;
  tipo?:
    | "text"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "email"
    | "password"
    | "json";
  requerido?: boolean;
  minimo?: number;
  maximo?: number;
  opciones?: Opcion[];
  origen?: string;
  etiquetaOrigen?: string;
  ayuda?: string;
  inicial?: unknown;
  soloCrear?: boolean;
};
export type Columna = {
  nombre: string;
  etiqueta: string;
  mostrar?: (registro: Registro) => string;
};
export type Modulo = {
  recurso: string;
  titulo: string;
  singular: string;
  descripcion: string;
  campos: Campo[];
  columnas: Columna[];
  administrador?: boolean;
  soloLectura?: boolean;
  capturaOperador?: boolean;
  filtros?: Campo[];
  eliminacion?: string;
};

export const estados: Opcion[] = [
  { valor: "activo", etiqueta: "Activo" },
  { valor: "inactivo", etiqueta: "Inactivo" },
];
export const tiposOperacion: Opcion[] = [
  { valor: "riego", etiqueta: "Riegos" },
  { valor: "fertilizante", etiqueta: "Fertilizantes" },
  { valor: "herbicida", etiqueta: "Herbicidas" },
  { valor: "practica_general", etiqueta: "Prácticas" },
  { valor: "fumigacion", etiqueta: "Fumigaciones" },
  { valor: "otro", etiqueta: "Otras operaciones" },
];
export const estadosOperacion: Opcion[] = [
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "confirmada", etiqueta: "Confirmada" },
  { valor: "pagada", etiqueta: "Pagada" },
  { valor: "pendiente_pago", etiqueta: "Pendiente de pago" },
  { valor: "cancelada", etiqueta: "Cancelada" },
];
export const categorias: Opcion[] = [
  { valor: "fertilizante", etiqueta: "Fertilizante" },
  { valor: "fungicida", etiqueta: "Fungicida" },
  { valor: "insecticida", etiqueta: "Insecticida" },
  { valor: "herbicida", etiqueta: "Herbicida" },
  { valor: "adyuvante", etiqueta: "Coadyuvante" },
  { valor: "otro", etiqueta: "Otro" },
];
export const pagos: Opcion[] = [
  { valor: "hora", etiqueta: "Hora" },
  { valor: "dia", etiqueta: "Día" },
  { valor: "jornal", etiqueta: "Jornal" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
  { valor: "otro", etiqueta: "Otro" },
];
export const roles: Opcion[] = [
  { valor: "admin", etiqueta: "Administrador" },
  { valor: "encargado", etiqueta: "Encargado" },
  { valor: "operador", etiqueta: "Operador" },
];
export const etiquetaValor = (valor: unknown, opciones: Opcion[]) =>
  opciones.find((opcion) => opcion.valor === String(valor))?.etiqueta ??
  String(valor ?? "—");
const accionesBitacora: Record<string, string> = {
  configuracion_inicial: "Configuración inicial",
  inicio_sesion: "Inicio de sesión",
  cierre_sesion: "Cierre de sesión",
  creacion: "Creación",
  modificacion: "Modificación",
  eliminacion: "Desactivación",
  creacion_usuario: "Creación de usuario",
  modificacion_usuario: "Modificación de usuario",
  desactivacion_usuario: "Desactivación de usuario",
  eliminacion_usuario: "Desactivación de usuario",
};
const nombresModulos: Record<string, string> = {
  autenticacion: "Autenticación",
  usuarios: "Usuarios",
  lotes: "Lotes",
  cultivos: "Cultivos",
  empleados: "Equipo de trabajo",
  productos: "Productos",
  mediciones: "Mediciones de campo",
  operaciones: "Operaciones de campo",
  bitacora: "Bitácora",
  clima: "Clima",
};
const textoLegible = (valor: unknown) =>
  String(valor ?? "—")
    .replaceAll("_", " ")
    .replace(/^./, (letra) => letra.toUpperCase());
export const etiquetaAccion = (valor: unknown) =>
  accionesBitacora[String(valor)] ?? textoLegible(valor);
export const etiquetaModulo = (valor: unknown) =>
  nombresModulos[String(valor)] ?? textoLegible(valor);
const estado: Campo = {
  nombre: "estado",
  etiqueta: "Estado",
  tipo: "select",
  requerido: true,
  opciones: estados,
  inicial: "activo",
};
const notas: Campo = { nombre: "notas", etiqueta: "Notas", tipo: "textarea" };
export const selectorLote: Campo = {
  nombre: "lote_id",
  etiqueta: "Lote",
  tipo: "select",
  requerido: true,
  origen: "/api/lotes?estado=activo",
  etiquetaOrigen: "nombre_lote",
};
export const selectorEncargado: Campo = {
  nombre: "encargado_id",
  etiqueta: "Encargado",
  tipo: "select",
  requerido: true,
  origen: "/api/usuarios/encargados",
  etiquetaOrigen: "nombre",
};
const columnaEstado: Columna = {
  nombre: "estado",
  etiqueta: "Estado",
  mostrar: (registro) => etiquetaValor(registro.estado, estados),
};

export const modulos: Record<string, Modulo> = {
  lotes: {
    recurso: "lotes",
    titulo: "Lotes",
    singular: "lote",
    descripcion:
      "Organiza el campo, conserva su historia y conecta cada lote con sus mediciones y operaciones.",
    campos: [
      { nombre: "nombre_lote", etiqueta: "Nombre del lote", requerido: true },
      { nombre: "codigo", etiqueta: "Código", requerido: true },
      {
        nombre: "superficie_ha",
        etiqueta: "Superficie",
        tipo: "number",
        requerido: true,
        minimo: 0,
        ayuda:
          "Ingresa la superficie en la unidad seleccionada. Se conserva su equivalencia en hectáreas.",
      },
      {
        nombre: "unidad_superficie",
        etiqueta: "Unidad de superficie",
        tipo: "select",
        requerido: true,
        inicial: "hectarea",
        opciones: [
          { valor: "hectarea", etiqueta: "Hectáreas" },
          { valor: "metro_cuadrado", etiqueta: "Metros cuadrados" },
          { valor: "acre", etiqueta: "Acres" },
        ],
      },
      { nombre: "variedad", etiqueta: "Variedad" },
      { nombre: "fecha_siembra", etiqueta: "Fecha de siembra", tipo: "date" },
      estado,
      { nombre: "ubicacion", etiqueta: "Ubicación" },
      {
        nombre: "lote_padre_id",
        etiqueta: "Lote de origen",
        tipo: "select",
        origen: "/api/lotes",
        etiquetaOrigen: "nombre_lote",
        ayuda: "Conserva la relación entre áreas del campo.",
      },
      {
        nombre: "latitud",
        etiqueta: "Latitud",
        tipo: "number",
        minimo: -90,
        maximo: 90,
        ayuda: "Captura latitud y longitud juntas para consultar el clima.",
      },
      {
        nombre: "longitud",
        etiqueta: "Longitud",
        tipo: "number",
        minimo: -180,
        maximo: 180,
      },
      notas,
    ],
    columnas: [
      { nombre: "nombre_lote", etiqueta: "Lote" },
      { nombre: "codigo", etiqueta: "Código" },
      {
        nombre: "superficie_ha",
        etiqueta: "Superficie",
        mostrar: (registro) =>
          Number(registro.superficie_ha).toLocaleString("es-MX") + " ha",
      },
      { nombre: "variedad", etiqueta: "Variedad" },
      columnaEstado,
    ],
    filtros: [estado],
  },
  cultivos: {
    recurso: "cultivos",
    titulo: "Cultivos",
    singular: "cultivo",
    descripcion:
      "Mantén el catálogo de cultivos y variedades, junto con sus datos e historial.",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", requerido: true },
      { nombre: "variedad", etiqueta: "Variedad" },
      estado,
      { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea" },
      notas,
    ],
    columnas: [
      { nombre: "nombre", etiqueta: "Cultivo" },
      { nombre: "variedad", etiqueta: "Variedad" },
      columnaEstado,
      {
        nombre: "fecha_actualizacion",
        etiqueta: "Actualizado",
        mostrar: (registro) => fechaLegible(registro.fecha_actualizacion),
      },
    ],
    filtros: [estado],
  },
  empleados: {
    recurso: "empleados",
    titulo: "Equipo de trabajo",
    singular: "empleado",
    descripcion:
      "Gestiona las tarifas del equipo. Cada operación conserva la tarifa aplicada en su registro.",
    campos: [
      {
        nombre: "nombre_completo",
        etiqueta: "Nombre completo",
        requerido: true,
      },
      {
        nombre: "tarifa_actual",
        etiqueta: "Tarifa actual (MXN)",
        tipo: "number",
        minimo: 0,
        requerido: true,
      },
      {
        nombre: "tipo_pago",
        etiqueta: "Tipo de pago",
        tipo: "select",
        opciones: pagos,
        requerido: true,
        inicial: "jornal",
      },
      {
        nombre: "unidad_pago",
        etiqueta: "Unidad de pago",
        requerido: true,
        inicial: "jornal",
      },
      { nombre: "fecha_contratacion", etiqueta: "Fecha de alta", tipo: "date" },
      estado,
      notas,
    ],
    columnas: [
      { nombre: "nombre_completo", etiqueta: "Empleado" },
      {
        nombre: "tarifa_actual",
        etiqueta: "Tarifa",
        mostrar: (registro) => dinero(registro.tarifa_actual),
      },
      {
        nombre: "tipo_pago",
        etiqueta: "Pago",
        mostrar: (registro) => etiquetaValor(registro.tipo_pago, pagos),
      },
      { nombre: "unidad_pago", etiqueta: "Unidad" },
      columnaEstado,
    ],
    filtros: [estado],
  },
  productos: {
    recurso: "productos",
    titulo: "Productos",
    singular: "producto",
    descripcion:
      "Insumos agrícolas y precios vigentes, con el historial de cada aplicación preservado.",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre comercial", requerido: true },
      { nombre: "codigo", etiqueta: "Código", requerido: true },
      {
        nombre: "categoria",
        etiqueta: "Categoría",
        tipo: "select",
        opciones: categorias,
        requerido: true,
        inicial: "fertilizante",
      },
      {
        nombre: "unidad_base",
        etiqueta: "Unidad base",
        tipo: "select",
        opciones: ["kg", "g", "L", "ml"].map((unidad) => ({
          valor: unidad,
          etiqueta: unidad,
        })),
        requerido: true,
        inicial: "kg",
      },
      {
        nombre: "precio_actual",
        etiqueta: "Precio actual (MXN)",
        tipo: "number",
        minimo: 0,
        ayuda: "Déjalo vacío si el precio todavía no está definido.",
      },
      { nombre: "proveedor", etiqueta: "Proveedor" },
      {
        nombre: "activo",
        etiqueta: "Estado",
        tipo: "select",
        opciones: [
          { valor: "true", etiqueta: "Activo" },
          { valor: "false", etiqueta: "Inactivo" },
        ],
        inicial: "true",
        requerido: true,
      },
      notas,
    ],
    columnas: [
      { nombre: "nombre", etiqueta: "Producto" },
      { nombre: "codigo", etiqueta: "Código" },
      {
        nombre: "categoria",
        etiqueta: "Categoría",
        mostrar: (registro) => etiquetaValor(registro.categoria, categorias),
      },
      {
        nombre: "precio_actual",
        etiqueta: "Precio",
        mostrar: (registro) =>
          registro.precio_actual == null
            ? "Sin precio"
            : dinero(registro.precio_actual),
      },
      { nombre: "unidad_base", etiqueta: "Unidad" },
      {
        nombre: "activo",
        etiqueta: "Estado",
        mostrar: (registro) => (registro.activo ? "Activo" : "Inactivo"),
      },
    ],
    filtros: [
      {
        nombre: "categoria",
        etiqueta: "Categoría",
        tipo: "select",
        opciones: categorias,
      },
    ],
  },
  mediciones: {
    recurso: "mediciones",
    titulo: "Mediciones de campo",
    singular: "medición",
    descripcion:
      "Registra el estado del suelo y consulta su evolución por lote y fecha.",
    capturaOperador: true,
    campos: [
      selectorLote,
      {
        nombre: "fecha_hora",
        etiqueta: "Fecha y hora",
        tipo: "datetime-local",
        requerido: true,
      },
      {
        nombre: "profundidad_cm",
        etiqueta: "Profundidad (cm)",
        tipo: "number",
        requerido: true,
        minimo: 0,
        maximo: 500,
      },
      {
        nombre: "humedad_porcentaje",
        etiqueta: "Humedad (%)",
        tipo: "number",
        requerido: true,
        minimo: 0,
        maximo: 100,
      },
      {
        nombre: "conductividad_ce",
        etiqueta: "Conductividad (dS/m)",
        tipo: "number",
        requerido: true,
        minimo: 0,
        maximo: 100,
      },
      {
        nombre: "ph_suelo",
        etiqueta: "pH del suelo",
        tipo: "number",
        requerido: true,
        minimo: 0,
        maximo: 14,
      },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "textarea" },
    ],
    columnas: [
      { nombre: "nombre_lote", etiqueta: "Lote" },
      {
        nombre: "fecha_hora",
        etiqueta: "Fecha",
        mostrar: (registro) => fechaLegible(registro.fecha_hora, true),
      },
      { nombre: "profundidad_cm", etiqueta: "Profundidad (cm)" },
      { nombre: "humedad_porcentaje", etiqueta: "Humedad (%)" },
      { nombre: "conductividad_ce", etiqueta: "Conductividad" },
      { nombre: "ph_suelo", etiqueta: "pH" },
      { nombre: "nombre_usuario", etiqueta: "Registró" },
    ],
    filtros: [{ ...selectorLote, requerido: false }],
  },
  operaciones: {
    recurso: "operaciones",
    titulo: "Operaciones de campo",
    singular: "operación",
    descripcion:
      "Coordina las labores del campo y conserva sus responsables, insumos y costos.",
    capturaOperador: true,
    campos: [
      selectorLote,
      {
        nombre: "tipo_operacion",
        etiqueta: "Tipo de operación",
        tipo: "select",
        requerido: true,
        opciones: tiposOperacion,
        inicial: "practica_general",
      },
      selectorEncargado,
      {
        nombre: "fecha_operacion",
        etiqueta: "Fecha de operación",
        tipo: "datetime-local",
        requerido: true,
      },
      {
        nombre: "descripcion",
        etiqueta: "Descripción",
        tipo: "textarea",
        requerido: true,
      },
      {
        nombre: "cantidad_dosificacion",
        etiqueta: "Cantidad / dosificación",
        tipo: "number",
        minimo: 0,
      },
      { nombre: "unidad_dosificacion", etiqueta: "Unidad de dosificación" },
      { nombre: "tipo_fertilizante", etiqueta: "Tipo de fertilizante" },
      {
        nombre: "estado",
        etiqueta: "Estado",
        tipo: "select",
        requerido: true,
        opciones: estadosOperacion,
        inicial: "confirmada",
      },
      {
        nombre: "cultivo_id",
        etiqueta: "Cultivo",
        tipo: "select",
        origen: "/api/cultivos?estado=activo",
        etiquetaOrigen: "nombre",
      },
      {
        nombre: "costo_aplicacion",
        etiqueta: "Costo de aplicación (MXN)",
        tipo: "number",
        minimo: 0,
        inicial: 0,
      },
      {
        nombre: "otros_costos",
        etiqueta: "Otros costos (MXN)",
        tipo: "number",
        minimo: 0,
        inicial: 0,
      },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "textarea" },
    ],
    columnas: [
      { nombre: "nombre_lote", etiqueta: "Lote" },
      {
        nombre: "tipo_operacion",
        etiqueta: "Operación",
        mostrar: (registro) =>
          etiquetaValor(registro.tipo_operacion, tiposOperacion),
      },
      { nombre: "nombre_encargado", etiqueta: "Encargado" },
      {
        nombre: "fecha_operacion",
        etiqueta: "Fecha",
        mostrar: (registro) => fechaLegible(registro.fecha_operacion, true),
      },
      {
        nombre: "estado",
        etiqueta: "Estado",
        mostrar: (registro) => etiquetaValor(registro.estado, estadosOperacion),
      },
      {
        nombre: "costo_total",
        etiqueta: "Costo total",
        mostrar: (registro) => dinero(registro.costo_total),
      },
    ],
    filtros: [
      { ...selectorLote, requerido: false },
      { ...selectorEncargado, requerido: false },
      {
        nombre: "estado",
        etiqueta: "Estado",
        tipo: "select",
        opciones: estadosOperacion,
      },
      { nombre: "tipo_fertilizante", etiqueta: "Tipo de fertilizante" },
    ],
  },
  usuarios: {
    recurso: "usuarios",
    titulo: "Administración de usuarios",
    singular: "usuario",
    descripcion:
      "Controla quién puede entrar al sistema y las responsabilidades de cada cuenta.",
    administrador: true,
    campos: [
      { nombre: "nombre", etiqueta: "Nombre completo", requerido: true },
      {
        nombre: "email",
        etiqueta: "Correo electrónico",
        tipo: "email",
        requerido: true,
      },
      {
        nombre: "contrasena",
        etiqueta: "Contraseña",
        tipo: "password",
        soloCrear: true,
        ayuda:
          "Mínimo 12 caracteres. Al editar, déjala vacía para conservar la contraseña actual.",
      },
      {
        nombre: "rol",
        etiqueta: "Rol",
        tipo: "select",
        opciones: roles,
        requerido: true,
        inicial: "operador",
      },
      estado,
    ],
    columnas: [
      { nombre: "nombre", etiqueta: "Usuario" },
      { nombre: "email", etiqueta: "Correo electrónico" },
      {
        nombre: "rol",
        etiqueta: "Rol",
        mostrar: (registro) => etiquetaValor(registro.rol, roles),
      },
      columnaEstado,
      {
        nombre: "fecha_creacion",
        etiqueta: "Alta",
        mostrar: (registro) => fechaLegible(registro.fecha_creacion),
      },
    ],
    filtros: [
      { nombre: "rol", etiqueta: "Rol", tipo: "select", opciones: roles },
      estado,
    ],
    eliminacion:
      "La cuenta se desactivará y perderá el acceso al sistema. Su historial se conservará.",
  },
  bitacora: {
    recurso: "bitacora",
    titulo: "Bitácora del sistema",
    singular: "registro",
    descripcion:
      "Consulta las acciones realizadas, sus responsables y la trazabilidad de la información.",
    administrador: true,
    soloLectura: true,
    campos: [],
    columnas: [
      {
        nombre: "fecha_hora",
        etiqueta: "Fecha y hora",
        mostrar: (registro) => fechaLegible(registro.fecha_hora, true),
      },
      { nombre: "nombre_usuario", etiqueta: "Usuario" },
      {
        nombre: "accion",
        etiqueta: "Acción",
        mostrar: (registro) => etiquetaAccion(registro.accion),
      },
      {
        nombre: "modulo",
        etiqueta: "Módulo",
        mostrar: (registro) => etiquetaModulo(registro.modulo),
      },
      { nombre: "ip", etiqueta: "Dirección de conexión" },
    ],
    filtros: [{ nombre: "modulo", etiqueta: "Módulo" }],
  },
};
