export const USER_ROLES = ['admin', 'editor', 'professor', 'aluno'] as const;
export type UserRole = (typeof USER_ROLES)[number];

