import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Form } from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import { createCategory } from '../../lib/categories';
import { uploadFile } from '../../lib/storageApi';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../components/argon/ArgonFormCard';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../components/argon/luditeca';
import { ADMIN_ONLY, isRole } from '../../lib/roles';

export default function NewCategory() {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { user, loading: isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    if (!isLoading && user && !isRole(user, ADMIN_ONLY)) router.replace('/books');
  }, [isLoading, user, router]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (!user?.id) throw new Error('Utilizador não autenticado');
      const fileExt = file.name.split('.').pop();
      const fileName = `categoria_${Date.now()}.${fileExt}`;
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
    setLoading(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error('O nome da categoria é obrigatório');
      const { error: createErr } = await createCategory({
        name: name.trim(),
        image_url: imageUrl,
        created_at: new Date().toISOString(),
      });
      if (createErr) throw new Error(createErr.message || 'Erro ao criar a categoria');
      toast.success('Categoria criada.');
      router.push('/categories');
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
        <ArgonCmsShell contentConstrained title="Nova categoria" loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Nova categoria | Luditeca</title>
      </Head>
      <ArgonCmsShell
        contentConstrained
        title="Criar categoria"
        subtitle="Adicione uma categoria à biblioteca."
        headerExtra={
          <LuditecaButton variant="link" size="sm" tag={Link} href="/categories" className="p-0">
            ← Voltar
          </LuditecaButton>
        }
      >
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        <ArgonFormCard title="Dados da categoria">
          <Form onSubmit={handleSubmit}>
            <LuditecaInput
              label="Nome"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <LuditecaInput
              label="Imagem"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              hint={uploading ? 'A enviar…' : undefined}
            />
            {imageUrl ? (
              <div className="mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Prévia" className="img-fluid rounded" style={{ maxHeight: 192 }} />
              </div>
            ) : null}
            <LuditecaButton variant="primary" type="submit" loading={loading} loadingLabel="A criar…">
              Criar categoria
            </LuditecaButton>
          </Form>
        </ArgonFormCard>
      </ArgonCmsShell>
    </Layout>
  );
}
