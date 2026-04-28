import { apiFetch } from './apiClient';

/**
 * Envia evento técnico do browser (ex.: falha de reprodução de vídeo) para `POST /telemetry/client`.
 * Falhas de rede são ignoradas para não afectar a edição.
 */
export async function reportClientTelemetry({ category, message, meta = {} }) {
  if (typeof window === 'undefined') return;
  try {
    await apiFetch('/telemetry/client', {
      method: 'POST',
      body: {
        category: String(category || 'general').slice(0, 64),
        message: String(message || 'event').slice(0, 500),
        meta: meta && typeof meta === 'object' ? meta : {},
      },
    });
  } catch {
    /* silencioso */
  }
}
