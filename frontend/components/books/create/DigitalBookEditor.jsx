import DigitalAssetPreview from './DigitalAssetPreview';
import { LuditecaInput } from '../../argon/luditeca';

export default function DigitalBookEditor({ form, onChange, onUpload, uploading }) {
  const uploadDoc = async (field, file) => {
    if (!file) return;
    const url = await onUpload(file, 'pages', `book-digital-${field}`);
    onChange({ [field]: url });
  };

  return (
    <>
      <p className="text-muted small mb-3">
        Pode guardar como rascunho e enviar PDF ou EPUB depois. Para publicar na app, é necessário
        pelo menos um ficheiro.
      </p>
      <LuditecaInput
        label="PDF"
        type="file"
        accept=".pdf,application/pdf"
        disabled={uploading}
        hint={form.pdf_url ? 'PDF carregado.' : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          uploadDoc('pdf_url', file);
          e.target.value = '';
        }}
      />
      <LuditecaInput
        label="EPUB"
        type="file"
        accept=".epub,application/epub+zip"
        disabled={uploading}
        hint={form.epub_url ? 'EPUB carregado.' : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          uploadDoc('epub_url', file);
          e.target.value = '';
        }}
      />
      <DigitalAssetPreview pdfUrl={form.pdf_url} epubUrl={form.epub_url} />
      <p className="small text-muted mb-0">
        Envie pelo menos um formato. A capa e metadados ficam na secção acima.
      </p>
    </>
  );
}
