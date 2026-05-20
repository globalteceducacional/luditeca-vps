import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from 'reactstrap';
import { createAuthor } from '../../../lib/authors';
import { uploadFile } from '../../../lib/storageApi';

const fc = 'luditeca-form-control';

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
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Novo autor</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {error ? <Alert color="danger">{error}</Alert> : null}
          <p className="small text-muted">
            O autor fica disponível de imediato neste formulário, sem sair do cadastro do livro.
          </p>
          <FormGroup>
            <Label className="form-control-label">Nome *</Label>
            <Input
              className={fc}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </FormGroup>
          <FormGroup>
            <Label className="form-control-label">Foto (opcional)</Label>
            <Input
              className={fc}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={busy}
            />
            {uploading ? <small className="text-muted d-block mt-1">A enviar imagem…</small> : null}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="mt-2 rounded border"
                style={{ maxHeight: 120, objectFit: 'contain' }}
              />
            ) : null}
          </FormGroup>
          <FormGroup className="mb-0">
            <Label className="form-control-label">Biografia</Label>
            <Input
              className={fc}
              type="textarea"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button type="button" color="secondary" outline onClick={toggle} disabled={busy}>
            Cancelar
          </Button>
          <Button color="primary" type="submit" disabled={busy}>
            {saving ? (
              <>
                <Spinner size="sm" className="mr-2" /> A criar…
              </>
            ) : (
              'Criar e selecionar'
            )}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
}
