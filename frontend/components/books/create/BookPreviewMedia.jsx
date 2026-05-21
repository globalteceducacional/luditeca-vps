import { useBookAssetPreviewUrl } from '../../../hooks/useBookAssetPreviewUrl';

/** Imagem de pré-visualização com resolução de URL e retry via API. */
export function BookPreviewImage({ url, bucket = 'pages', alt = '', className = '', style }) {
  const { src, failed, onMediaError } = useBookAssetPreviewUrl(url, bucket);

  if (!src && !url) return null;

  return (
    <>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={className}
          style={style}
          onError={onMediaError}
        />
      ) : null}
      {failed && !src ? (
        <p className="small text-danger mb-0">Não foi possível carregar a imagem. Verifique a API em execução.</p>
      ) : null}
    </>
  );
}

/** Áudio de pré-visualização. */
export function BookPreviewAudio({ url, bucket = 'pages', className = 'w-100 mb-3' }) {
  const { src, onMediaError } = useBookAssetPreviewUrl(url, bucket);
  if (!src) return null;
  return (
    <audio controls className={className} src={src} preload="metadata" onError={onMediaError}>
      <track kind="captions" />
    </audio>
  );
}
