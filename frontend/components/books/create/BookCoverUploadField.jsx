import { FiUpload } from 'react-icons/fi';
import { BOOK_MEDIA_BUCKETS, resolveBookAssetUrl } from '../../../lib/bookMediaSrc';
import { editorDark } from '../../../lib/editorDarkTheme';
import { LuditecaButton } from '../../argon/luditeca';

/**
 * Upload de capa com pré-visualização (fluxo Argon / assistente / editor v2).
 * @param {'cms'|'editor-dark'} [variant]
 */
export default function BookCoverUploadField({
  coverUrl = '',
  onUpload,
  uploading = false,
  disabled = false,
  variant = 'cms',
}) {
  const isDark = variant === 'editor-dark';

  return (
    <div className={isDark ? 'block' : 'form-group'}>
      <span className={isDark ? editorDark.label : 'form-control-label d-block'}>Capa</span>
      <div
        className={
          isDark
            ? 'mt-2 flex flex-wrap items-start gap-3'
            : 'd-flex flex-wrap align-items-start gap-3 mb-2'
        }
      >
        {coverUrl ? (
          <img
            src={resolveBookAssetUrl(coverUrl, BOOK_MEDIA_BUCKETS.cover) || coverUrl}
            alt=""
            className={isDark ? 'h-40 w-auto max-w-full rounded-lg border border-slate-700 object-contain' : 'rounded border'}
            style={isDark ? undefined : { maxHeight: 140, maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div
            className={
              isDark
                ? 'flex h-40 w-28 items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900/50 text-xs text-slate-500'
                : 'd-flex align-items-center justify-content-center rounded border bg-light text-muted small'
            }
            style={isDark ? undefined : { width: 112, height: 140 }}
          >
            Sem capa
          </div>
        )}
        <label className="mb-0 cursor-pointer">
          <LuditecaButton
            theme={isDark ? 'editor-dark' : 'cms'}
            editorVariant="ghost"
            variant={isDark ? undefined : 'primary'}
            size="sm"
            tag={isDark ? undefined : 'span'}
            className={isDark ? undefined : 'mb-0'}
            disabled={disabled || uploading}
          >
            <FiUpload size={16} />
            {uploading ? 'A enviar…' : 'Carregar imagem'}
          </LuditecaButton>
          <input
            type="file"
            accept="image/*"
            className="hidden d-none"
            onChange={onUpload}
            disabled={disabled || uploading}
          />
        </label>
      </div>
    </div>
  );
}
