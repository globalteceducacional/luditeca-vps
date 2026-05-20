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
import { createCategory } from '../../../lib/categories';
import { uploadFile } from '../../../lib/storageApi';

const fc = 'luditeca-form-control';

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
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle}>Nova categoria</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {error ? <Alert color="danger">{error}</Alert> : null}
          <p className="small text-muted">
            A categoria fica disponível de imediato neste formulário, sem sair do cadastro do livro.
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
          <FormGroup className="mb-0">
            <Label className="form-control-label">Imagem (opcional)</Label>
            <Input
              className={fc}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={busy}
            />
            {uploading ? <small className="text-muted d-block mt-1">A enviar imagem…</small> : null}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="mt-2 rounded border"
                style={{ maxHeight: 120, objectFit: 'contain' }}
              />
            ) : null}
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
