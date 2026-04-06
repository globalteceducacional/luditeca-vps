function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function startEditorMetric() {
  return nowMs();
}

export function endEditorMetric(startAt) {
  return Math.max(0, nowMs() - Number(startAt || 0));
}

export function reportEditorMetric(name, valueMs, meta = {}) {
  if (typeof window === 'undefined') return;
  const payload = {
    name: String(name || 'unknown'),
    valueMs: Math.round(Number(valueMs || 0) * 100) / 100,
    meta: meta && typeof meta === 'object' ? meta : {},
    at: Date.now(),
  };
  const key = '__luditecaEditorMetrics';
  const list = Array.isArray(window[key]) ? window[key] : [];
  list.push(payload);
  if (list.length > 300) list.shift();
  window[key] = list;
  if (process.env.NODE_ENV !== 'production') {
    console.info('[editor-metric]', payload.name, payload.valueMs, payload.meta);
  }
}
