/** Converte strings vazias em null em campos numéricos (payloads de livros/páginas). */
export function sanitizeNumericFields(data, fieldNames = []) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  const defaultNumericFields = [
    'id',
    'author_id',
    'category_id',
    'order',
    'position',
    'parent_id',
    'zIndex',
    'step',
    'width',
    'height',
    'x',
    'y',
    'size',
    'rotation',
  ];

  const fieldsToCheck = [...defaultNumericFields, ...fieldNames];

  fieldsToCheck.forEach((field) => {
    if (sanitized[field] === '') {
      sanitized[field] = null;
    }
  });

  Object.keys(sanitized).forEach((key) => {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item) => {
        if (typeof item === 'object' && item !== null) {
          return sanitizeNumericFields(item, fieldNames);
        }
        return item;
      });
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeNumericFields(sanitized[key], fieldNames);
    }
  });

  return sanitized;
}
