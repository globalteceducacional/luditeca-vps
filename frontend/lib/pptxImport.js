import { getAccessToken, getApiBaseUrl } from './apiClient';

function runImportXhr({ accessToken, formData, jsonBody, onProgress, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const safeProgress = (info) => {
      try {
        onProgress?.(info);
      } catch {
        /* ignore */
      }
    };

    const xhr = new XMLHttpRequest();
    const timeoutId = setTimeout(() => {
      xhr.abort();
    }, timeoutMs);

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(arg);
    };

    const base = getApiBaseUrl();
    const url = `${base}/books/import-pptx`;

    if (formData) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
          safeProgress({
            phase: 'upload',
            percent: pct,
            message: `${pct}%`,
          });
        } else {
          safeProgress({
            phase: 'upload',
            percent: null,
            message: 'Enviando…',
          });
        }
      });

      xhr.upload.addEventListener('loadend', () => {
        safeProgress({
          phase: 'processing',
          percent: null,
          message: 'Processando…',
        });
      });
    } else {
      safeProgress({
        phase: 'processing',
        percent: null,
        message: 'Processando…',
      });
    }

    xhr.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
        safeProgress({
          phase: 'processing',
          percent: pct,
          message: `${pct}%`,
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 413) {
        finish(
          reject,
          new Error('Arquivo maior que o limite do servidor (ajuste client_max_body_size no Nginx).'),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        let payload;
        try {
          payload = JSON.parse(xhr.responseText || '{}');
        } catch {
          finish(reject, new Error('Resposta inválida do servidor.'));
          return;
        }
        safeProgress({
          phase: 'done',
          percent: 100,
          message: '100%',
        });
        finish(resolve, payload);
        return;
      }

      let errorMessage = 'Falha ao importar o arquivo PPTX.';
      try {
        const j = JSON.parse(xhr.responseText || '{}');
        if (j?.error) errorMessage = j.error;
      } catch {
        /* ignore */
      }
      finish(reject, new Error(errorMessage));
    });

    xhr.addEventListener('error', () => {
      finish(reject, new Error('Erro de rede ao importar o PPTX.'));
    });

    xhr.addEventListener('abort', () => {
      finish(
        reject,
        new Error(
          'Tempo esgotado ou importação cancelada. Tente de novo ou use um arquivo menor.',
        ),
      );
    });

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    if (jsonBody) {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(jsonBody));
    } else {
      xhr.send(formData);
    }
  });
}

/**
 * Importa PPTX via API (multipart). O ficheiro é enviado para luditeca-back.
 */
export function importPptxForBook({ bookId, userId, file, onProgress }) {
  if (!bookId) {
    return Promise.reject(new Error('Livro inválido para importação.'));
  }

  if (!userId) {
    return Promise.reject(new Error('Usuário inválido para importação.'));
  }

  if (!file) {
    return Promise.reject(new Error('Selecione um arquivo .pptx.'));
  }

  const fileName = file.name?.toLowerCase?.() || '';
  if (!fileName.endsWith('.pptx')) {
    return Promise.reject(new Error('Somente arquivos .pptx são aceitos.'));
  }

  const maxSizeBytes = 500 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return Promise.reject(new Error('Arquivo muito grande. Limite de 500MB por importação.'));
  }

  const timeoutMs = 45 * 60 * 1000;

  return (async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookId', String(bookId));
    formData.append('userId', String(userId));
    onProgress?.({
      phase: 'upload',
      percent: 0,
      message: '0%',
    });
    return runImportXhr({
      accessToken,
      formData,
      jsonBody: null,
      onProgress,
      timeoutMs,
    });
  })();
}
