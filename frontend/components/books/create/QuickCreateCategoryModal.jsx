import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Form } from 'reactstrap';
import { createCategory } from '../../../lib/categories';
import { uploadFile } from '../../../lib/storageApi';
import { LuditecaAlert, LuditecaButton, LuditecaInput, LuditecaModal } from '../../argon/luditeca';

export default function QuickCreateCategoryModal({ isOpen, toggle, onCreated }) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setImageUrl('');
      setUploading(false);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `categoria_quick_${Date.now()}.${ext}`;
      const { url } = await uploadFile('categories', fileName, file);
      setImageUrl(url || '');
      toast.success('Imagem enviada.');
    } catch (err) {
      const msg = err?.message || 'Erro ao enviar a imagem.';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('O nome da categoria é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await createCategory({
      name: trimmed,
      image_url: imageUrl || null,
    });
    setSaving(false);
    if (err || !data) {
      setError(err?.message || 'Não foi possível criar a categoria.');
      return;
    }
    onCreated?.(data);
    toggle();
  };

  const busy = saving || uploading;

  return (
    <LuditecaModal
      isOpen={isOpen}
      toggle={toggle}
      title="Nova categoria"
      footer={
        <>
          <LuditecaButton variant="outline" type="button" onClick={toggle} disabled={busy}>
            Cancelar
          </LuditecaButton>
          <LuditecaButton
            variant="primary"
            type="submit"
            form="quick-create-category-form"
            disabled={busy}
            loading={saving}
            loadingLabel="A criar…"
          >
            Criar e selecionar
          </LuditecaButton>
        </>
      }
    >
      <Form id="quick-create-category-form" onSubmit={handleSubmit}>
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        <p className="small text-muted">
          A categoria fica disponível de imediato neste formulário, sem sair do cadastro do livro.
        </p>
        <LuditecaInput
          label="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <LuditecaInput
          label="Imagem (opcional)"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={busy}
          hint={uploading ? 'A enviar imagem…' : undefined}
          formGroupClassName="mb-0"
        />
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="mt-2 rounded border"
            style={{ maxHeight: 120, objectFit: 'contain' }}
          />
        ) : null}
      </Form>
    </LuditecaModal>
  );
}
