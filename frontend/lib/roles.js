export const ROLES = {
  admin: 'admin',
  editor: 'editor',
  professor: 'professor',
  aluno: 'aluno',
};

export const CMS_ROLES = [ROLES.admin, ROLES.editor];
export const ADMIN_ONLY = [ROLES.admin];
/** App infantil (aluno/professor); admin/editor para testes no mesmo build. */
export const APP_ROLES = [ROLES.aluno, ROLES.professor, ROLES.admin, ROLES.editor];

export function isRole(user, allowed) {
  const role = user?.role;
  return !!role && allowed.includes(role);
}

