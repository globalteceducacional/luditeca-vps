import { FormGroup, Input, Label } from 'reactstrap';

const fc = 'luditeca-form-control';

export default function DigitalBookEditor({ form, onChange, onUpload, uploading }) {
  const uploadDoc = async (field, file, accept) => {
    if (!file) return;
    const url = await onUpload(file, 'pages', `book-digital-${field}`);
    onChange({ [field]: url });
  };

  return (
    <>
      <FormGroup>
        <Label className="form-control-label">PDF</Label>
        <Input
          className={fc}
          type="file"
          accept=".pdf,application/pdf"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            uploadDoc('pdf_url', file);
            e.target.value = '';
          }}
        />
        {form.pdf_url ? <p className="small text-success mt-1">PDF carregado.</p> : null}
      </FormGroup>
      <FormGroup>
        <Label className="form-control-label">EPUB</Label>
        <Input
          className={fc}
          type="file"
          accept=".epub,application/epub+zip"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            uploadDoc('epub_url', file);
            e.target.value = '';
          }}
        />
        {form.epub_url ? <p className="small text-success mt-1">EPUB carregado.</p> : null}
      </FormGroup>
      <p className="small text-muted mb-0">
        Envie pelo menos um formato. A capa e metadados ficam na secção acima.
      </p>
    </>
  );
}
