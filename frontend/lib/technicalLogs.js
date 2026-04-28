import { apiFetch } from './apiClient';

export async function fetchTechnicalLogs({ limit = 50, offset = 0, level, category, user_id } = {}) {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  if (level?.trim()) q.set('level', level.trim());
  if (category?.trim()) q.set('category', category.trim());
  if (user_id?.trim()) q.set('user_id', user_id.trim());
  const qs = q.toString();
  return apiFetch(`/admin/technical-logs?${qs}`);
}
