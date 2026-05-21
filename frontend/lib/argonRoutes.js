import { ROLES } from './roles';

/**
 * Rotas da sidebar CMS (Argon Dashboard React — Creative Tim).
 * `shape` → classe Argon `icon-shape-*` (círculos coloridos como na demo /admin).
 */
export const CMS_NAV = [
  { path: '/books', name: 'Livros', icon: 'ni ni-book-bookmark', shape: 'primary' },
  { path: '/admin', name: 'Área Admin', icon: 'ni ni-app', shape: 'info' },
];

/** Grupos hierárquicos da sidebar (Design System v1). */
export const CMS_SIDEBAR_GROUPS = [
  {
    id: 'content',
    label: 'Conteúdo',
    items: CMS_NAV,
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    items: 'CMS_METADATA_NAV',
  },
  {
    id: 'system',
    label: 'Sistema',
    items: 'ADMIN_NAV',
    adminOnly: true,
  },
  {
    id: 'account',
    label: 'Conta',
    items: 'CMS_ACCOUNT_NAV',
  },
  {
    id: 'preview',
    label: 'Experiência',
    items: 'APP_PREVIEW_NAV',
  },
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

const NAV_MAP = {
  CMS_METADATA_NAV,
  ADMIN_NAV,
  CMS_ACCOUNT_NAV,
  APP_PREVIEW_NAV,
};

/**
 * Sidebar agrupada conforme papel do utilizador.
 * @param {{ role?: string } | null} user
 * @returns {{ id: string, label: string, items: typeof CMS_NAV }[]}
 */
export function buildCmsSidebarGroups(user) {
  const isAdmin = user?.role === ROLES.admin;

  return CMS_SIDEBAR_GROUPS.filter((group) => !group.adminOnly || isAdmin).map((group) => ({
    id: group.id,
    label: group.label,
    items: typeof group.items === 'string' ? NAV_MAP[group.items] || [] : group.items,
  }));
}

/** Lista plana (retrocompatível). */
export function buildCmsSidebarRoutes(user) {
  return buildCmsSidebarGroups(user).flatMap((g) => g.items);
}
