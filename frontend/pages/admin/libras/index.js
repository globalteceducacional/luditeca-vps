import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert,
  Button,
  Media,
  Spinner,
  Table,
} from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import { useAuth } from '../../../contexts/auth';
import {
  deleteLibrasLesson,
  listLibrasLessons,
  reorderLibrasLessons,
} from '../../../lib/librasLessons';
import { CMS_ROLES, isRole } from '../../../lib/roles';

export default function AdminLibrasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listLibrasLessons({ limit: 200 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, CMS_ROLES)) load();
  }, [user, load]);

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setRows(next);
    const { error: err } = await reorderLibrasLessons(next.map((r) => r.id));
    if (err) {
      setError(err.message);
      await load();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta lição?')) return;
    const { error: err } = await deleteLibrasLesson(id);
    if (err) setError(err.message);
    else await load();
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>LIBRAS | Admin</title>
      </Head>
      <ArgonCmsShell
        title="Lições LIBRAS"
        subtitle="Ordene e edite o conteúdo de LIBRAS na app."
        actionLabel="Nova lição"
        actionIcon="ni ni-fat-add"
        onAction={() => router.push('/admin/libras/new/edit')}
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </Button>
        }
        loading={loading && rows.length === 0}
      >
        {error ? <Alert color="danger">{error}</Alert> : null}
        <ArgonTableCard title="Lições">
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <Table className="align-items-center table-flush" responsive>
              <thead className="thead-light">
                <tr>
                  <th>Ordem</th>
                  <th>Lição</th>
                  <th>Categoria</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0 border-0">
                      <ArgonEmptyState
                        variant="inline"
                        icon="ni ni-app"
                        iconShape="info"
                        title="Nenhuma lição LIBRAS"
                        description="Adicione lições com vídeo e imagens para a app."
                        primaryLabel="Nova lição"
                        primaryHref="/admin/libras/new/edit"
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <Button color="default" size="sm" className="mr-1" onClick={() => move(index, -1)}>
                          <i className="ni ni-bold-up" />
                        </Button>
                        <Button color="default" size="sm" onClick={() => move(index, 1)}>
                          <i className="ni ni-bold-down" />
                        </Button>
                      </td>
                      <th scope="row">
                        <Media className="align-items-center">
                          {row.image_url ? (
                            <span className="avatar rounded-circle mr-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt="" src={row.image_url} />
                            </span>
                          ) : null}
                          <Media body>
                            <span className="mb-0 text-sm font-weight-bold">{row.word}</span>
                          </Media>
                        </Media>
                      </th>
                      <td>{row.category || '—'}</td>
                      <td className="text-right">
                        <Button
                          color="info"
                          size="sm"
                          tag={Link}
                          href={`/admin/libras/${row.id}/edit`}
                          className="mr-1"
                        >
                          Editar
                        </Button>
                        <Button color="danger" size="sm" onClick={() => handleDelete(row.id)}>
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </ArgonTableCard>
      </ArgonCmsShell>
    </Layout>
  );
}
