import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Media,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import { getAuthors, deleteAuthor } from '../../lib/authors';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import ArgonCmsShell, { ArgonTableCard } from '../../components/argon/ArgonCmsShell';
import ArgonEmptyState from '../../components/argon/ArgonEmptyState';
import ArgonSearchInput from '../../components/argon/ArgonSearchInput';
import { CMS_ROLES, ROLES, isRole } from '../../lib/roles';

export default function Authors() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const canManageAuthors = user?.role === ROLES.admin;
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) fetchAuthors();
  }, [user]);

  const fetchAuthors = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await getAuthors();
      if (err) throw err;
      const rows = (data || []).map((author) => {
        let imageUrl = null;
        if (author.photo_url) {
          imageUrl = author.photo_url.startsWith('http')
            ? author.photo_url
            : getFileUrl('autores', author.photo_url);
        }
        return { ...author, imageUrl };
      });
      setAuthors(rows);
    } catch {
      setError('Falha ao carregar os autores.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAuthor = async (id) => {
    if (!window.confirm('Excluir este autor? Esta ação não pode ser desfeita.')) return;
    try {
      setDeleteLoading(id);
      const { error: err } = await deleteAuthor(id);
      if (err) throw err;
      setAuthors((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Falha ao excluir o autor.');
    } finally {
      setDeleteLoading(null);
    }
  };

  const filtered = authors.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.bio?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (authLoading || !user) return null;

  return (
    <>
      <Head>
        <title>Autores | Luditeca CMS</title>
      </Head>
      <Layout>
        <ArgonCmsShell
          title="Autores"
          subtitle={
            canManageAuthors
              ? 'Gestão de autores do catálogo.'
              : 'Consulta de autores (apenas administradores podem criar ou editar).'
          }
          actionLabel={canManageAuthors ? 'Novo autor' : undefined}
          actionIcon={canManageAuthors ? 'ni ni-fat-add' : undefined}
          onAction={canManageAuthors ? () => router.push('/authors/new') : undefined}
          loading={loading}
        >
          <Row className="mb-4">
            <Col lg="6" md="8">
              <Card className="shadow border-0 mb-4">
                <CardBody>
                  <ArgonSearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Pesquisar por nome ou biografia…"
                  />
                </CardBody>
              </Card>
            </Col>
          </Row>

          {error ? <Alert color="danger">{error}</Alert> : null}

          {authors.length === 0 ? (
            canManageAuthors ? (
              <ArgonEmptyState
                icon="ni ni-single-02"
                iconShape="success"
                title="Nenhum autor cadastrado"
                description="Os autores aparecem nos livros e no catálogo. Comece por criar o primeiro."
                primaryLabel="Cadastrar primeiro autor"
                primaryHref="/authors/new"
              />
            ) : (
              <ArgonEmptyState
                icon="ni ni-single-02"
                iconShape="secondary"
                title="Nenhum autor"
                description="Contacte um administrador para criar autores no sistema."
              />
            )
          ) : filtered.length === 0 ? (
            <ArgonEmptyState
              icon="ni ni-zoom-split"
              iconShape="warning"
              title="Nenhum resultado"
              description={`Não encontrámos nada para "${searchTerm}".`}
              secondaryLabel="Limpar pesquisa"
              onSecondary={() => setSearchTerm('')}
            />
          ) : (
            <ArgonTableCard title="Lista de autores">
              <div className="table-responsive">
                <Table className="align-items-center table-flush" hover>
                  <thead className="thead-light">
                    <tr>
                      <th scope="col">Autor</th>
                      <th scope="col">Biografia</th>
                      {canManageAuthors ? <th scope="col" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((author) => (
                      <tr key={author.id}>
                        <th scope="row">
                          <Media className="align-items-center">
                            <span className="avatar avatar-sm rounded-circle mr-3">
                              {author.imageUrl ? (
                                <img alt="" src={author.imageUrl} />
                              ) : (
                                <span className="avatar avatar-sm rounded-circle bg-secondary" />
                              )}
                            </span>
                            <Media body>
                              <span className="mb-0 text-sm font-weight-bold">
                                {author.name || 'Sem nome'}
                              </span>
                            </Media>
                          </Media>
                        </th>
                        <td className="text-sm text-muted" style={{ maxWidth: 320 }}>
                          {author.bio || '—'}
                        </td>
                        {canManageAuthors ? (
                          <td className="text-right">
                            <Button
                              color="primary"
                              size="sm"
                              outline
                              className="mr-2"
                              onClick={() => router.push(`/authors/${author.id}/edit`)}
                            >
                              Editar
                            </Button>
                            <Button
                              color="danger"
                              size="sm"
                              outline
                              disabled={deleteLoading === author.id}
                              onClick={() => handleDeleteAuthor(author.id)}
                            >
                              {deleteLoading === author.id ? <Spinner size="sm" /> : 'Excluir'}
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
