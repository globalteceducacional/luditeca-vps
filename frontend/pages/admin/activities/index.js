import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert,
  Badge,
  Button,
  Spinner,
  Table,
} from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import { useAuth } from '../../../contexts/auth';
import { deleteActivity, listActivities, updateActivity } from '../../../lib/activities';
import { CMS_ROLES, isRole } from '../../../lib/roles';

export default function AdminActivitiesPage() {
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
    const { data, error: err } = await listActivities({ limit: 100 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, CMS_ROLES)) load();
  }, [user, load]);

  const togglePublish = async (row) => {
    const { error: err } = await updateActivity(row.id, { is_published: !row.is_published });
    if (err) setError(err.message);
    else await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta atividade?')) return;
    const { error: err } = await deleteActivity(id);
    if (err) setError(err.message);
    else await load();
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>Atividades | Admin</title>
      </Head>
      <ArgonCmsShell
        title="Atividades"
        subtitle="Gestão de atividades interativas na app infantil."
        actionLabel="Nova"
        actionIcon="ni ni-fat-add"
        onAction={() => router.push('/admin/activities/new/edit')}
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </Button>
        }
        loading={loading && rows.length === 0}
      >
        {error ? <Alert color="danger">{error}</Alert> : null}
        <ArgonTableCard title="Registos">
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <Table className="align-items-center table-flush" responsive>
              <thead className="thead-light">
                <tr>
                  <th>Atividade</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0 border-0">
                      <ArgonEmptyState
                        variant="inline"
                        icon="ni ni-bullet-list-67"
                        iconShape="info"
                        title="Nenhuma atividade"
                        description="Crie quizzes e jogos para a app infantil."
                        primaryLabel="Nova atividade"
                        primaryHref="/admin/activities/new/edit"
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        <span className="mb-0 text-sm font-weight-bold">
                          {row.icon ? `${row.icon} ` : ''}
                          {row.title}
                        </span>
                      </th>
                      <td>{row.type || '—'}</td>
                      <td>
                        <Badge color={row.is_published ? 'success' : 'secondary'} pill>
                          {row.is_published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Button
                          color="info"
                          size="sm"
                          tag={Link}
                          href={`/admin/activities/${row.id}/edit`}
                          className="mr-1"
                        >
                          Editar
                        </Button>
                        <Button color="default" size="sm" onClick={() => togglePublish(row)} className="mr-1">
                          {row.is_published ? 'Despublicar' : 'Publicar'}
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
