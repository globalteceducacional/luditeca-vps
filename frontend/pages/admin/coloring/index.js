import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import {
  Alert,
  Badge,
  Button,
  Form,
  FormGroup,
  Input,
  Media,
  Spinner,
  Table,
} from 'reactstrap';
import AdminImageUploadField from '../../../components/admin/AdminImageUploadField';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../../components/argon/ArgonFormCard';
import { useAuth } from '../../../contexts/auth';
import {
  createColoringPage,
  deleteColoringPage,
  listColoringPages,
  updateColoringPage,
} from '../../../lib/coloringPages';
import { CMS_ROLES, isRole } from '../../../lib/roles';

const emptyForm = () => ({
  title: '',
  image_url: '',
  default_id: '',
  svg_type: '',
});

export default function AdminColoringPage() {
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
    const { data, error: err } = await listColoringPages({ limit: 100 });
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
      default_id: row.default_id || '',
      svg_type: row.svg_type || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      image_url: form.image_url?.trim() || null,
      default_id: form.default_id?.trim() || null,
      svg_type: form.svg_type?.trim() || null,
    };
    const { error: err } = editingId
      ? await updateColoringPage(editingId, payload)
      : await createColoringPage(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success(editingId ? 'Pintura atualizada.' : 'Pintura criada.');
    closeForm();
    await load();
  };

  const togglePublish = async (row) => {
    const { error: err } = await updateColoringPage(row.id, {
      is_published: !row.is_published,
    });
    if (err) setError(err.message);
    else await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta pintura?')) return;
    const { error: err } = await deleteColoringPage(id);
    if (err) setError(err.message);
    else await load();
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>Pinturas | Admin</title>
      </Head>
      <ArgonCmsShell
        title="Pinturas"
        subtitle="Gestão de páginas para colorir na app infantil."
        actionLabel="Nova"
        actionIcon="ni ni-fat-add"
        onAction={openCreate}
        actionDisabled={formOpen}
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </Button>
        }
        loading={loading && rows.length === 0}
      >
        {error ? <Alert color="danger">{error}</Alert> : null}
        {formOpen ? (
          <ArgonFormCard className="mb-4" title={editingId ? 'Editar pintura' : 'Nova pintura'}>
            <Form onSubmit={handleSubmit}>
              <FormGroup>
                <label className="form-control-label">Título *</label>
                <Input
                  className="luditeca-form-control"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </FormGroup>
              <AdminImageUploadField
                label="Imagem"
                uploadKind="coloring"
                value={form.image_url}
                onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              />
              <FormGroup>
                <label className="form-control-label">default_id</label>
                <Input
                  className="luditeca-form-control"
                  placeholder="Override SVG padrão"
                  value={form.default_id}
                  onChange={(e) => setForm((f) => ({ ...f, default_id: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <label className="form-control-label">svg_type</label>
                <Input
                  className="luditeca-form-control"
                  placeholder="Opcional"
                  value={form.svg_type}
                  onChange={(e) => setForm((f) => ({ ...f, svg_type: e.target.value }))}
                />
              </FormGroup>
              <Button color="primary" type="submit" disabled={saving} className="mr-2">
                {saving ? <Spinner size="sm" /> : editingId ? 'Guardar' : 'Criar'}
              </Button>
              <Button color="secondary" type="button" onClick={closeForm}>
                Cancelar
              </Button>
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
                  <th>Pintura</th>
                  <th>Estado</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-0 border-0">
                      <ArgonEmptyState
                        variant="inline"
                        icon="ni ni-image"
                        iconShape="info"
                        title="Nenhuma pintura"
                        description="Adicione páginas para colorir com imagem ou SVG."
                        primaryLabel="Nova pintura"
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
                      <td>
                        <Badge color={row.is_published ? 'success' : 'secondary'} pill>
                          {row.is_published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Button color="info" size="sm" onClick={() => openEdit(row)} className="mr-1">
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
