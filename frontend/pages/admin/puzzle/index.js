import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { Badge, Form, Media, Spinner, Table } from 'reactstrap';
import AdminImageUploadField from '../../../components/admin/AdminImageUploadField';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../../components/argon/luditeca';
import ArgonFormCard from '../../../components/argon/ArgonFormCard';
import { useAuth } from '../../../contexts/auth';
import {
  createPuzzleGame,
  deletePuzzleGame,
  listPuzzleGames,
  updatePuzzleGame,
} from '../../../lib/puzzleGames';
import { CMS_ROLES, isRole } from '../../../lib/roles';

const PIECE_OPTIONS = [15, 30, 60, 120, 240];

const emptyForm = () => ({
  title: '',
  image_url: '',
  piece_count: 15,
  description: '',
  caption: '',
});

export default function AdminPuzzlePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listPuzzleGames({ limit: 100 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, CMS_ROLES)) load();
  }, [user, load]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '',
      image_url: row.image_url || '',
      piece_count: row.piece_count || 15,
      description: row.description || '',
      caption: row.caption || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.image_url?.trim()) {
      setError('Envie ou indique a URL da imagem.');
      toast.error('Imagem obrigatória.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      image_url: form.image_url.trim(),
      piece_count: form.piece_count,
      description: form.description?.trim() || null,
      caption: form.caption?.trim() || null,
    };
    const { error: err } = editingId
      ? await updatePuzzleGame(editingId, payload)
      : await createPuzzleGame(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success(editingId ? 'Puzzle atualizado.' : 'Puzzle criado.');
    closeForm();
    await load();
  };

  const togglePublish = async (row) => {
    const { error: err } = await updatePuzzleGame(row.id, {
      is_published: !row.is_published,
    });
    if (err) setError(err.message);
    else await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este quebra-cabeça?')) return;
    const { error: err } = await deletePuzzleGame(id);
    if (err) setError(err.message);
    else await load();
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>Quebra-cabeça | Admin</title>
      </Head>
      <ArgonCmsShell
        contentConstrained
        title="Quebra-cabeça"
        subtitle="Gestão de puzzles para a app infantil."
        actionLabel="Novo"
        actionIcon="ni ni-fat-add"
        onAction={openCreate}
        actionDisabled={formOpen}
        headerExtra={
          <LuditecaButton variant="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </LuditecaButton>
        }
        loading={loading && rows.length === 0}
        loadingVariant="table"
        loadingLabel="Quebra-cabeça"
      >
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        {formOpen ? (
          <ArgonFormCard className="mb-4" title={editingId ? 'Editar puzzle' : 'Novo puzzle'}>
            <Form onSubmit={handleSubmit}>
              <LuditecaInput
                label="Título"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <AdminImageUploadField
                label="Imagem do puzzle"
                uploadKind="puzzle"
                required
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />
              <LuditecaInput
                label="Descrição"
                type="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <LuditecaInput
                label="Legenda"
                value={form.caption}
                onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              />
              <LuditecaInput
                label="Peças"
                type="select"
                value={form.piece_count}
                onChange={(e) => setForm((f) => ({ ...f, piece_count: Number(e.target.value) }))}
              >
                {PIECE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} peças
                  </option>
                ))}
              </LuditecaInput>
              <LuditecaButton variant="primary" type="submit" disabled={saving} loading={saving} className="mr-2">
                {editingId ? 'Guardar' : 'Criar'}
              </LuditecaButton>
              <LuditecaButton variant="outline" type="button" onClick={closeForm}>
                Cancelar
              </LuditecaButton>
            </Form>
          </ArgonFormCard>
        ) : null}
        <ArgonTableCard title="Registos">
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <Table className="align-items-center table-flush" responsive>
              <thead className="thead-light">
                <tr>
                  <th>Puzzle</th>
                  <th>Peças</th>
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
                        icon="ni ni-app"
                        iconShape="info"
                        title="Nenhum quebra-cabeça"
                        description="Crie um puzzle com imagem e número de peças."
                        primaryLabel="Novo puzzle"
                        onPrimary={openCreate}
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        <Media className="align-items-center">
                          {row.image_url ? (
                            <span className="avatar rounded-circle mr-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt="" src={row.image_url} />
                            </span>
                          ) : null}
                          <Media body>
                            <span className="mb-0 text-sm font-weight-bold">{row.title}</span>
                          </Media>
                        </Media>
                      </th>
                      <td>{row.piece_count}</td>
                      <td>
                        <Badge color={row.is_published ? 'success' : 'secondary'} pill>
                          {row.is_published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <LuditecaButton variant="info" size="sm" onClick={() => openEdit(row)} className="mr-1">
                          Editar
                        </LuditecaButton>
                        <LuditecaButton variant="outline" size="sm" onClick={() => togglePublish(row)} className="mr-1">
                          {row.is_published ? 'Despublicar' : 'Publicar'}
                        </LuditecaButton>
                        <LuditecaButton variant="danger" size="sm" onClick={() => handleDelete(row.id)}>
                          Excluir
                        </LuditecaButton>
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
