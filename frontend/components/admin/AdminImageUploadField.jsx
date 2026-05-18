import { useState } from 'react';
import { FiImage, FiUpload } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { Input } from 'reactstrap';
import { uploadAdminContentImage } from '../../lib/adminContentUpload';

/**
 * Campo de imagem: upload para storage + URL manual opcional.
 * @param {{ label: string, value: string, onChange: (url: string) => void, uploadKind: string, required?: boolean }} props
 */
export default function AdminImageUploadField({
  label,
  value,
  onChange,
  uploadKind,
  required = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadAdminContentImage(file, uploadKind);
      onChange(url);
      toast.success('Imagem enviada.');
    } catch (err) {
      const msg = err?.message || 'Falha no upload.';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="form-group">
      <label className="form-control-label">
        {label}
        {required ? ' *' : ''}
      </label>

      {value ? (
        <div className="d-flex align-items-start mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="rounded border bg-light mr-3"
            style={{ width: 80, height: 80, objectFit: 'cover' }}
          />
          <button type="button" onClick={() => onChange('')} className="btn btn-link btn-sm p-0 text-danger">
            Remover imagem
          </button>
        </div>
      ) : null}

      <label
        className={`d-inline-flex align-items-center rounded border border-dashed border-secondary bg-light px-3 py-2 small text-dark mb-2 ${
          uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
      >
        <FiUpload size={16} className="mr-2" />
        {uploading ? 'A enviar…' : 'Escolher ficheiro'}
        <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={handleFile} />
      </label>

      <div className="d-flex align-items-center small text-muted mb-2">
        <FiImage size={12} className="mr-1" />
        <span>ou cole uma URL abaixo</span>
      </div>

      <Input
        type="url"
        className="luditeca-form-control"
        placeholder="https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required && !value}
      />

      {uploadError ? <p className="small text-danger mb-0 mt-1">{uploadError}</p> : null}
    </div>
  );
}
