import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Col, Form, Row, Spinner, Table } from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonFormCard from '../../../components/argon/ArgonFormCard';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import { LuditecaAlert, LuditecaButton, LuditecaInput, LuditecaModal } from '../../../components/argon/luditeca';
import { useAuth } from '../../../contexts/auth';
import { ROLES } from '../../../lib/roles';
import { createUser, deleteUser, listUsers, updateUser } from '../../../lib/users';

const ROLE_OPTIONS = [
  { value: ROLES.admin, label: 'Administrador' },
  { value: ROLES.editor, label: 'Editor' },
  { value: ROLES.professor, label: 'Professor' },
  { value: ROLES.aluno, label: 'Aluno' },
];

export default function AdminUsers() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({ email: '', name: '', role: ROLES.aluno, password: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: ROLES.aluno, password: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role !== ROLES.admin) router.replace('/books');
  }, [authLoading, user, router]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await listUsers();
    if (fetchErr) {
      setError(fetchErr.message || 'Falha ao carregar usuários.');
      setRows([]);
    } else {
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.role === ROLES.admin) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => String(a.email).localeCompare(String(b.email)));
  }, [rows]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: createErr } = await createUser({
      email: form.email.trim(),
      name: form.name.trim() || null,
      role: form.role,
      password: form.password,
    });
    setSaving(false);
    if (createErr) setError(createErr.message || 'Falha ao criar usuário.');
    else {
      setForm({ email: '', name: '', role: ROLES.aluno, password: '' });
      await fetchUsers();
    }
  };

  const handleQuickRoleChange = async (id, nextRole) => {
    const prev = rows;
    setRows((r) => r.map((u) => (u.id === id ? { ...u, role: nextRole } : u)));
    const { error: updateErr } = await updateUser(id, { role: nextRole });
    if (updateErr) {
      setRows(prev);
      setError(updateErr.message || 'Falha ao atualizar role.');
    }
  };

  const openEdit = (u) => {
    setError(null);
    setEditingId(u.id);
    setEditForm({ name: u.name || '', role: u.role, password: '' });
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', role: ROLES.aluno, password: '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setError(null);
    const { error: updateErr } = await updateUser(editingId, {
      name: editForm.name.trim() || null,
      role: editForm.role,
      ...(editForm.password ? { password: editForm.password } : {}),
    });
    setEditSaving(false);
    if (updateErr) {
      setError(updateErr.message || 'Falha ao editar usuário.');
      return;
    }
    closeEdit();
    await fetchUsers();
  };

  const handleDelete = async (u) => {
    setError(null);
    if (u.id === user?.id) {
      setError('Você não pode excluir a própria conta.');
      return;
    }
    if (!window.confirm(`Excluir o usuário "${u.email}"? Essa ação não pode ser desfeita.`)) return;
    const { error: delErr } = await deleteUser(u.id);
    if (delErr) setError(delErr.message || 'Falha ao excluir usuário.');
    else await fetchUsers();
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>Usuários | Admin</title>
      </Head>
      <ArgonCmsShell
        contentConstrained
        title="Usuários"
        subtitle="Gestão de contas e perfis (apenas administrador)."
        loading={loading && sorted.length === 0}
        loadingVariant="table"
        loadingLabel="Utilizadores"
        headerExtra={
          <LuditecaButton variant="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </LuditecaButton>
        }
      >
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        <ArgonFormCard title="Criar novo usuário" className="mb-4">
            <Form onSubmit={handleCreate}>
              <Row>
                <Col md="3">
                  <LuditecaInput
                    formGroupClassName="mb-3"
                    placeholder="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </Col>
                <Col md="3">
                  <LuditecaInput
                    formGroupClassName="mb-3"
                    placeholder="Nome (opcional)"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Col>
                <Col md="2">
                  <LuditecaInput
                    formGroupClassName="mb-3"
                    type="select"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </LuditecaInput>
                </Col>
                <Col md="2">
                  <LuditecaInput
                    formGroupClassName="mb-3"
                    type="password"
                    placeholder="Senha"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={6}
                    required
                  />
                </Col>
                <Col md="2" className="d-flex align-items-start">
                  <LuditecaButton variant="primary" type="submit" disabled={saving} loading={saving} block>
                    Criar
                  </LuditecaButton>
                </Col>
              </Row>
            </Form>
        </ArgonFormCard>
        <ArgonTableCard
          title="Lista"
          toolbar={
            <LuditecaButton variant="outline" size="sm" onClick={fetchUsers}>
              Recarregar
            </LuditecaButton>
          }
        >
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <Table className="align-items-center table-flush" responsive>
              <thead className="thead-light">
                <tr>
                  <th>Email</th>
                  <th>Nome</th>
                  <th>Role</th>
                  <th>Criado em</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0 border-0">
                      <ArgonEmptyState
                        variant="inline"
                        icon="ni ni-single-02"
                        iconShape="secondary"
                        title="Nenhum utilizador"
                        description="Utilize o formulário acima para criar o primeiro acesso ao CMS ou à app."
                      />
                    </td>
                  </tr>
                ) : (
                  sorted.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.name || '—'}</td>
                      <td>
                        <LuditecaInput
                          type="select"
                          formGroupClassName="mb-0"
                          bsSize="sm"
                          value={u.role}
                          onChange={(e) => handleQuickRoleChange(u.id, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </LuditecaInput>
                      </td>
                      <td className="text-muted">
                        {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="text-right">
                        <LuditecaButton variant="info" size="sm" onClick={() => openEdit(u)} className="mr-1">
                          Editar
                        </LuditecaButton>
                        <LuditecaButton
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(u)}
                          disabled={u.id === user?.id}
                        >
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
        <LuditecaModal
          isOpen={Boolean(editingId)}
          toggle={closeEdit}
          title="Editar usuário"
          footer={
            <>
              <LuditecaButton variant="outline" type="button" onClick={closeEdit}>
                Cancelar
              </LuditecaButton>
              <LuditecaButton variant="primary" type="submit" form="admin-user-edit-form" disabled={editSaving} loading={editSaving}>
                Salvar
              </LuditecaButton>
            </>
          }
        >
          <Form id="admin-user-edit-form" onSubmit={handleSaveEdit}>
            <LuditecaInput
              label="Nome"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <LuditecaInput
              label="Role"
              type="select"
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </LuditecaInput>
            <LuditecaInput
              label="Nova senha (opcional)"
              type="password"
              minLength={6}
              placeholder="Deixe em branco para não alterar"
              value={editForm.password}
              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Form>
        </LuditecaModal>
      </ArgonCmsShell>
    </Layout>
  );
}
