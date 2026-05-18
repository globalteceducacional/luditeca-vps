import { apiFetch, getAccessToken, getApiBaseUrl } from './apiClient';

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

/**
 * Descarrega CSV da trilha (filtros opcionais, até 5000 linhas no servidor).
 * @param {{ book_id?: string; action_code?: string }} opts
 */
export async function downloadAuditLogsCsv(opts = {}) {
  const { book_id, action_code } = opts;
  const params = new URLSearchParams();
  if (book_id) params.set('book_id', String(book_id));
  if (action_code) params.set('action_code', action_code);

  const base = getApiBaseUrl();
  const token = getAccessToken();
  const url = `${base}/admin/audit-logs/export.csv?${params.toString()}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = 'Falha ao exportar CSV.';
    try {
      const json = await res.json();
      if (json?.error) msg = json.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
