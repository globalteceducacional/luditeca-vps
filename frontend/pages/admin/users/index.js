import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
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
    const { data, error } = await listUsers();
    if (error) {
      setError(error.message || 'Falha ao carregar usuários.');
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
    const payload = {
      email: form.email.trim(),
      name: form.name.trim() || null,
      role: form.role,
      password: form.password,
    };
    const { error } = await createUser(payload);
    if (error) setError(error.message || 'Falha ao criar usuário.');
    setSaving(false);
    if (!error) {
      setForm({ email: '', name: '', role: ROLES.aluno, password: '' });
      await fetchUsers();
    }
  };

  const handleQuickRoleChange = async (id, nextRole) => {
    const prev = rows;
    setRows((r) => r.map((u) => (u.id === id ? { ...u, role: nextRole } : u)));
    const { error } = await updateUser(id, { role: nextRole });
    if (error) {
      setRows(prev);
      setError(error.message || 'Falha ao atualizar role.');
    }
  };

  const openEdit = (u) => {
    setError(null);
    setEditingId(u.id);
    setEditForm({
      name: u.name || '',
      role: u.role,
      password: '',
    });
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

    const payload = {
      name: editForm.name.trim() || null,
      role: editForm.role,
      ...(editForm.password ? { password: editForm.password } : {}),
    };

    const { error } = await updateUser(editingId, payload);
    setEditSaving(false);
    if (error) {
      setError(error.message || 'Falha ao editar usuário.');
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
    const ok = window.confirm(`Excluir o usuário "${u.email}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;

    const { error } = await deleteUser(u.id);
    if (error) {
      setError(error.message || 'Falha ao excluir usuário.');
      return;
    }
    await fetchUsers();
  };

  if (authLoading) return null;
  if (!user) return null;

  return (
    <Layout>
      <Head>
        <title>Usuários | Admin</title>
      </Head>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Usuários</h1>
          <button onClick={fetchUsers} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
            Recarregar
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">Criar novo usuário</h2>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleCreate}>
            <input
              className="border rounded px-3 py-2"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Nome (opcional)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <select
              className="border rounded px-3 py-2"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              className="border rounded px-3 py-2"
              placeholder="Senha"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={6}
              required
            />

            <div className="md:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 rounded text-white ${saving ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {saving ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">Lista</div>
          {loading ? (
            <div className="p-4">Carregando...</div>
          ) : sorted.length === 0 ? (
            <div className="p-4 text-gray-600">Nenhum usuário.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        className="border rounded px-2 py-1"
                        value={u.role}
                        onChange={(e) => handleQuickRoleChange(u.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
                          disabled={u.id === user?.id}
                          title={u.id === user?.id ? 'Você não pode excluir a própria conta' : 'Excluir usuário'}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editingId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow w-full max-w-lg overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold">Editar usuário</div>
                <button onClick={closeEdit} className="px-2 py-1 rounded hover:bg-gray-100">
                  Fechar
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha (opcional)</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    type="password"
                    minLength={6}
                    placeholder="Deixe em branco para não alterar"
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={closeEdit} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className={`px-4 py-2 rounded text-white ${editSaving ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {editSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

