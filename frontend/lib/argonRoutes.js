/**
 * Rotas da sidebar CMS (Argon Dashboard React — Creative Tim).
 * `shape` → classe Argon `icon-shape-*` (círculos coloridos como na demo /admin).
 */
export const CMS_NAV = [
  { path: '/books', name: 'Livros', icon: 'ni ni-book-bookmark', shape: 'primary' },
  { path: '/admin', name: 'Área Admin', icon: 'ni ni-app', shape: 'info' },
];

/**
 * Atividades, LIBRAS, puzzle e pinturas: apenas dentro do hub `/admin` (abas).
 * Rotas completas mantêm-se (`/admin/activities`, …) para “Gestão completa” / edição.
 */

/** Metadados do catálogo — qualquer editor CMS (admin ou editor). */
export const CMS_METADATA_NAV = [
  { path: '/authors', name: 'Autores', icon: 'ni ni-single-02', shape: 'success' },
  { path: '/categories', name: 'Categorias', icon: 'ni ni-tag', shape: 'warning' },
];

/** Apenas administrador (utilizadores, auditoria, telemetria). */
export const ADMIN_NAV = [
  { path: '/admin/users', name: 'Utilizadores', icon: 'ni ni-circle-08', shape: 'danger' },
  { path: '/admin/audit', name: 'Trilha de ações', icon: 'ni ni-archive-2', shape: 'default' },
  { path: '/admin/telemetry', name: 'Telemetria', icon: 'ni ni-chart-bar-32', shape: 'primary' },
];

/** Conta e preferências (qualquer utilizador CMS). */
export const CMS_ACCOUNT_NAV = [
  { path: '/profile', name: 'Perfil', icon: 'ni ni-settings-gear-65', shape: 'dark' },
];

/** Link rápido para área infantil (preview). */
export const APP_PREVIEW_NAV = [
  { path: '/app', name: 'App (preview)', icon: 'ni ni-button-play', shape: 'success' },
];
