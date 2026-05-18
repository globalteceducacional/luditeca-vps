import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Alert, Button, Form, FormGroup, Input, Spinner } from 'reactstrap';
import { useAuth } from '../../../contexts/auth';
import { getCategory, updateCategory } from '../../../lib/categories';
import { getFileUrl } from '../../../lib/mediaUrl';
import { uploadFile } from '../../../lib/storageApi';
import Layout from '../../../components/Layout';
import ArgonCmsShell from '../../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../../components/argon/ArgonFormCard';
import { ADMIN_ONLY, isRole } from '../../../lib/roles';

export default function EditCategory() {
  const router = useRouter();
  const { id } = router.query;

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { user, loading: isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && !isRole(user, ADMIN_ONLY)) router.replace('/books');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (id && user) fetchCategory();
  }, [id, user]);

  const fetchCategory = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await getCategory(id);
      if (fetchErr) throw fetchErr;
      if (!data) throw new Error('Categoria não encontrada');
      setName(data.name || '');
      let url = '';
      if (data.image_url) {
        url = data.image_url.startsWith('http')
          ? data.image_url
          : getFileUrl('categories', data.image_url);
      }
      setImageUrl(url);
    } catch (err) {
      setError(err.message || 'Erro ao carregar a categoria');
      toast.error(err.message || 'Erro ao carregar a categoria');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Utilizador não autenticado');
      const fileExt = file.name.split('.').pop();
      const fileName = `categoria_${id || 'edit'}_${Date.now()}.${fileExt}`;
      const { url } = await uploadFile('categories', fileName, file);
      setImageUrl(url);
      toast.success('Imagem enviada.');
    } catch {
      setError('Erro ao fazer upload da imagem');
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('O nome da categoria é obrigatório');
      const { error: updateErr } = await updateCategory(id, {
        name: name.trim(),
        image_url: imageUrl,
      });
      if (updateErr) throw new Error(updateErr.message || 'Erro ao atualizar a categoria');
      toast.success('Categoria atualizada.');
      router.push('/categories');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <Layout>
        <ArgonCmsShell title="Editar categoria" loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Editar categoria | Luditeca</title>
      </Head>
      <ArgonCmsShell
        title="Editar categoria"
        subtitle="Atualize os dados da categoria."
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/categories" className="p-0">
            ← Voltar
          </Button>
        }
      >
        {error ? <Alert color="danger">{error}</Alert> : null}
        <ArgonFormCard title="Dados da categoria">
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <label className="form-control-label">Nome *</label>
              <Input
                className="luditeca-form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup>
              <label className="form-control-label">Imagem</label>
              <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              {uploading ? <small className="text-muted">A enviar…</small> : null}
              {imageUrl ? (
                <div className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Prévia" className="img-fluid rounded" style={{ maxHeight: 192 }} />
                </div>
              ) : null}
            </FormGroup>
            <Button color="primary" type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Guardar alterações'}
            </Button>
          </Form>
        </ArgonFormCard>
      </ArgonCmsShell>
    </Layout>
  );
}
