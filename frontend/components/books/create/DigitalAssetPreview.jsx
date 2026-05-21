import { useState } from 'react';
import { Button } from 'reactstrap';
import LuditecaAlert from '../../argon/LuditecaAlert';
import { useBookAssetPreviewUrl } from '../../../hooks/useBookAssetPreviewUrl';

function PdfPreview({ pdfUrl }) {
  const { src } = useBookAssetPreviewUrl(pdfUrl, 'pages');
  if (!src) return null;
  const iframeSrc = src.includes('#') ? src : `${src}#toolbar=0&navpanes=0`;
  return (
    <>
      <p className="small font-weight-bold text-muted mb-1">PDF</p>
      <iframe
        title="Pré-visualização PDF"
        src={iframeSrc}
        className="w-100 rounded border mb-2"
        style={{ height: 420, minHeight: 240 }}
      />
      <p className="small mb-3">
        <a href={src} target="_blank" rel="noopener noreferrer">
          Abrir PDF em novo separador
        </a>
      </p>
    </>
  );
}

export default function DigitalAssetPreview({ pdfUrl, epubUrl }) {
  const [open, setOpen] = useState(false);
  const { src: epubSrc } = useBookAssetPreviewUrl(epubUrl, 'pages');
  const hasPdf = Boolean(String(pdfUrl || '').trim());
  const hasEpub = Boolean(epubSrc || String(epubUrl || '').trim());

  if (!hasPdf && !hasEpub) return null;

  return (
    <div className="mt-3">
      <Button color="info" outline size="sm" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar pré-visualização' : 'Pré-visualizar ficheiros'}
      </Button>
      {open ? (
        <div className="mt-3">
          {hasPdf ? <PdfPreview pdfUrl={pdfUrl} /> : null}
          {hasEpub ? (
            <p className="small mb-0">
              <strong>EPUB:</strong>{' '}
              <a href={epubSrc || epubUrl} target="_blank" rel="noopener noreferrer">
                Abrir ficheiro EPUB
              </a>
            </p>
          ) : null}
          <LuditecaAlert color="light" className="small border mt-2 mb-0">
            A pré-visualização usa ficheiros em <code>/media</code> na API (
            <code>localhost:3020</code> em desenvolvimento). Confirme que o backend está a correr.
          </LuditecaAlert>
        </div>
      ) : null}
    </div>
  );
}
