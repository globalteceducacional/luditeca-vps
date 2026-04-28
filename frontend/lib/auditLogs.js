import { apiFetch } from './apiClient';

/**
 * Lista trilha de auditoria (apenas administrador na API).
 * @param {{ limit?: number; offset?: number; book_id?: string; action_code?: string }} opts
 */
export async function fetchAuditLogs(opts = {}) {
  const { limit = 50, offset = 0, book_id, action_code } = opts;
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (book_id) params.set('book_id', String(book_id));
  if (action_code) params.set('action_code', action_code);
  return apiFetch(`/admin/audit-logs?${params.toString()}`);
}
