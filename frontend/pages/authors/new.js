import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Alert, Button, Form, FormGroup, Input, Spinner } from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import { createAuthor } from '../../lib/authors';
import { uploadFile } from '../../lib/storageApi';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../components/argon/ArgonFormCard';
import { ADMIN_ONLY, isRole } from '../../lib/roles';

export default function NewAuthor() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { user, loading: isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && !isRole(user, ADMIN_ONLY)) router.replace('/books');
  }, [isLoading, user, router]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Utilizador não autenticado');
      const fileExt = file.name.split('.').pop();
      const fileName = `autor_new_${Date.now()}.${fileExt}`;
      const { url } = await uploadFile('autores', fileName, file);
      setPhotoUrl(url);
      toast.success('Foto enviada.');
    } catch {
      setError('Erro ao fazer upload da foto');
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('O nome do autor é obrigatório');
      const { error: createErr } = await createAuthor({
        name: name.trim(),
        bio: bio.trim() || null,
        photo_url: photoUrl,
        created_at: new Date().toISOString(),
      });
      if (createErr) throw new Error(createErr.message || 'Erro ao criar o autor');
      toast.success('Autor criado.');
      router.push('/authors');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <ArgonCmsShell title="Novo autor" loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Novo autor | Luditeca</title>
      </Head>
      <ArgonCmsShell
        title="Criar autor"
        subtitle="Adicione um autor à biblioteca."
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/authors" className="p-0">
            ← Voltar
          </Button>
        }
      >
        {error ? <Alert color="danger">{error}</Alert> : null}
        <ArgonFormCard title="Dados do autor">
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
              <label className="form-control-label">Biografia</label>
              <Input
                className="luditeca-form-control"
                type="textarea"
                rows="4"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <label className="form-control-label">Foto</label>
              <Input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              {uploading ? <small className="text-muted">A enviar…</small> : null}
              {photoUrl ? (
                <div className="mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Prévia" className="img-fluid rounded" style={{ maxHeight: 192 }} />
                </div>
              ) : null}
            </FormGroup>
            <Button color="primary" type="submit" disabled={loading}>
              {loading ? <Spinner size="sm" /> : 'Criar autor'}
            </Button>
          </Form>
        </ArgonFormCard>
      </ArgonCmsShell>
    </Layout>
  );
}
