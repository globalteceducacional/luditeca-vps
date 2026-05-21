import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Form } from 'reactstrap';
import { createAuthor } from '../../../lib/authors';
import { uploadFile } from '../../../lib/storageApi';
import { LuditecaAlert, LuditecaButton, LuditecaInput, LuditecaModal } from '../../argon/luditeca';

export default function QuickCreateAuthorModal({ isOpen, toggle, onCreated }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setBio('');
      setPhotoUrl('');
      setUploading(false);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `autor_quick_${Date.now()}.${ext}`;
      const { url } = await uploadFile('autores', fileName, file);
      setPhotoUrl(url || '');
      toast.success('Foto enviada.');
    } catch (err) {
      const msg = err?.message || 'Erro ao enviar a foto.';
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
      setError('O nome do autor é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: err } = await createAuthor({
      name: trimmed,
      bio: bio.trim() || null,
      photo_url: photoUrl || null,
    });
    setSaving(false);
    if (err || !data) {
      setError(err?.message || 'Não foi possível criar o autor.');
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
      title="Novo autor"
      footer={
        <>
          <LuditecaButton variant="outline" type="button" onClick={toggle} disabled={busy}>
            Cancelar
          </LuditecaButton>
          <LuditecaButton variant="primary" type="submit" form="quick-create-author-form" disabled={busy} loading={saving} loadingLabel="A criar…">
            Criar e selecionar
          </LuditecaButton>
        </>
      }
    >
      <Form id="quick-create-author-form" onSubmit={handleSubmit}>
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        <p className="small text-muted">
          O autor fica disponível de imediato neste formulário, sem sair do cadastro do livro.
        </p>
        <LuditecaInput
          label="Nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <LuditecaInput
          label="Foto (opcional)"
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          disabled={busy}
          hint={uploading ? 'A enviar imagem…' : undefined}
        />
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="mb-3 rounded border"
            style={{ maxHeight: 120, objectFit: 'contain' }}
          />
        ) : null}
        <LuditecaInput
          label="Biografia"
          type="textarea"
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          formGroupClassName="mb-0"
        />
      </Form>
    </LuditecaModal>
  );
}
