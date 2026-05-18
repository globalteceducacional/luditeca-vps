import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Media,
  Spinner,
  Table,
} from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import { getCategories, deleteCategory } from '../../lib/categories';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import ArgonCmsShell, { ArgonTableCard } from '../../components/argon/ArgonCmsShell';
import ArgonEmptyState from '../../components/argon/ArgonEmptyState';
import ArgonSearchInput from '../../components/argon/ArgonSearchInput';
import { CMS_ROLES, ROLES, isRole } from '../../lib/roles';

export default function Categories() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageCategories = user?.role === ROLES.admin;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchCategories();
  }, [user]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await getCategories();
      if (err) throw err;
      const rows = (data || []).map((category) => {
        let imageUrl = null;
        if (category.image_url?.trim()) {
          imageUrl = category.image_url.startsWith('http')
            ? category.image_url
            : getFileUrl('categories', category.image_url);
        }
        return { ...category, imageUrl };
      });
      setCategories(rows);
    } catch {
      setError('Falha ao carregar as categorias.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Excluir esta categoria?')) return;
    try {
      setDeleteLoading(id);
      const { error: err } = await deleteCategory(id);
      if (err) throw err;
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Falha ao excluir a categoria.');
    } finally {
      setDeleteLoading(null);
    }
  };

  const filtered = categories.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (authLoading || !user) return null;

  return (
    <>
      <Head>
        <title>Categorias | Luditeca CMS</title>
      </Head>
      <Layout>
        <ArgonCmsShell
          title="Categorias"
          subtitle={
            canManageCategories
              ? 'Organização do catálogo de livros.'
              : 'Consulta de categorias (apenas administradores podem criar ou editar).'
          }
          actionLabel={canManageCategories ? 'Nova categoria' : undefined}
          actionIcon={canManageCategories ? 'ni ni-fat-add' : undefined}
          onAction={canManageCategories ? () => router.push('/categories/new') : undefined}
          loading={loading}
        >
          <Card className="shadow border-0 mb-4">
            <CardBody>
              <ArgonSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Pesquisar categoria…"
              />
            </CardBody>
          </Card>

          {error ? <Alert color="danger">{error}</Alert> : null}

          {categories.length === 0 ? (
            canManageCategories ? (
              <ArgonEmptyState
                icon="ni ni-tag"
                iconShape="warning"
                title="Nenhuma categoria"
                description="As categorias organizam o catálogo de livros na Luditeca."
                primaryLabel="Criar primeira categoria"
                primaryHref="/categories/new"
              />
            ) : (
              <ArgonEmptyState
                icon="ni ni-tag"
                iconShape="secondary"
                title="Nenhuma categoria"
                description="Contacte um administrador para criar categorias."
              />
            )
          ) : filtered.length === 0 ? (
            <ArgonEmptyState
              icon="ni ni-zoom-split"
              iconShape="info"
              title="Nenhum resultado"
              description={`Não há categorias que correspondam a "${searchTerm}".`}
              secondaryLabel="Limpar pesquisa"
              onSecondary={() => setSearchTerm('')}
            />
          ) : (
            <ArgonTableCard title="Lista de categorias">
              <div className="table-responsive">
                <Table className="align-items-center table-flush" hover>
                  <thead className="thead-light">
                    <tr>
                      <th scope="col">Categoria</th>
                      {canManageCategories ? <th scope="col" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((cat) => (
                      <tr key={cat.id}>
                        <th scope="row">
                          <Media className="align-items-center">
                            <span className="avatar avatar-sm rounded-circle mr-3">
                              {cat.imageUrl ? (
                                <img alt="" src={cat.imageUrl} />
                              ) : (
                                <span className="avatar avatar-sm rounded-circle bg-secondary" />
                              )}
                            </span>
                            <Media body>
                              <span className="mb-0 text-sm font-weight-bold">{cat.name}</span>
                            </Media>
                          </Media>
                        </th>
                        {canManageCategories ? (
                          <td className="text-right">
                            <Button
                              color="primary"
                              size="sm"
                              outline
                              className="mr-2"
                              onClick={() => router.push(`/categories/${cat.id}/edit`)}
                            >
                              Editar
                            </Button>
                            <Button
                              color="danger"
                              size="sm"
                              outline
                              disabled={deleteLoading === cat.id}
                              onClick={() => handleDeleteCategory(cat.id)}
                            >
                              {deleteLoading === cat.id ? <Spinner size="sm" /> : 'Excluir'}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </ArgonTableCard>
          )}
        </ArgonCmsShell>
      </Layout>
    </>
  );
}
