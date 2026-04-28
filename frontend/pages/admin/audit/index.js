import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../contexts/auth';
import { ROLES } from '../../../lib/roles';
import { fetchAuditLogs } from '../../../lib/auditLogs';

export default function AdminAuditPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookIdFilter, setBookIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const limit = 40;

  const load = useCallback(async () => {
    if (user?.role !== ROLES.admin) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchAuditLogs({
        limit,
        offset,
        book_id: bookIdFilter.trim() || undefined,
        action_code: actionFilter.trim() || undefined,
      });
      setRows(Array.isArray(json?.data) ? json.data : []);
      setTotal(typeof json?.total === 'number' ? json.total : 0);
    } catch (e) {
      setError(e.message || 'Falha ao carregar trilha.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role, offset, bookIdFilter, actionFilter]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role !== ROLES.admin) router.replace('/books');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.role === ROLES.admin) load();
  }, [user?.role, load, reloadNonce]);

  const applyFilters = (e) => {
    e.preventDefault();
    setOffset(0);
    setReloadNonce((n) => n + 1);
  };

  return (
    <>
      <Head>
        <title>Trilha de ações | Luditeca CMS</title>
      </Head>
      <Layout>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <h1 className="text-2xl font-bold mb-2">Trilha de ações (auditoria)</h1>
          <p className="text-gray-600 text-sm mb-6">
            Eventos com código <code className="bg-gray-100 px-1 rounded">EVT:*</code>, utilizador e alvo{' '}
            <code className="bg-gray-100 px-1 rounded">BOOK:</code>, <code className="bg-gray-100 px-1 rounded">USER:</code>, etc.
          </p>

          <form onSubmit={applyFilters} className="flex flex-wrap gap-3 items-end mb-6">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Filtrar por livro (id)</label>
              <input
                value={bookIdFilter}
                onChange={(e) => setBookIdFilter(e.target.value)}
                className="border rounded px-2 py-1 w-36"
                placeholder="ex: 12"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Código / texto</label>
              <input
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="border rounded px-2 py-1 w-48"
                placeholder="EVT:BOOK"
              />
            </div>
            <button type="submit" className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              Aplicar
            </button>
            <button
              type="button"
              className="px-4 py-1 border rounded text-sm"
              onClick={() => {
                setBookIdFilter('');
                setActionFilter('');
                setOffset(0);
                setReloadNonce((n) => n + 1);
              }}
            >
              Limpar
            </button>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">{error}</div>
          )}

          {loading ? (
            <p className="text-gray-600">A carregar…</p>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Código</th>
                      <th className="p-2">Ator</th>
                      <th className="p-2">Alvo</th>
                      <th className="p-2">Livro</th>
                      <th className="p-2">Página</th>
                      <th className="p-2">Metadados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-gray-500 text-center">
                          Sem registos.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 whitespace-nowrap">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                          <td className="p-2 font-mono text-xs">{r.actionCode}</td>
                          <td className="p-2 font-mono text-xs break-all max-w-[120px]">{r.actorUserId || '—'}</td>
                          <td className="p-2 text-xs break-all max-w-[140px]">
                            {r.targetType && r.targetId ? `${r.targetType}: ${r.targetId}` : r.targetId || '—'}
                          </td>
                          <td className="p-2">{r.bookId != null ? String(r.bookId) : '—'}</td>
                          <td className="p-2 text-xs">{r.pageRef || '—'}</td>
                          <td className="p-2 text-xs max-w-xs truncate" title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                            {r.metadata ? JSON.stringify(r.metadata) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                <span>
                  Total: {total} · Mostrando {offset + 1}–{Math.min(offset + rows.length, offset + limit)}
                </span>
                <div className="space-x-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={offset + rows.length >= total}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                    onClick={() => setOffset((o) => o + limit)}
                  >
                    Seguinte
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
