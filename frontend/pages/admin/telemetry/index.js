import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../contexts/auth';
import { ROLES } from '../../../lib/roles';
import { fetchTechnicalLogs } from '../../../lib/technicalLogs';

export default function AdminTelemetryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const limit = 40;

  const load = useCallback(async () => {
    if (user?.role !== ROLES.admin) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchTechnicalLogs({
        limit,
        offset,
        level: levelFilter.trim() || undefined,
        category: categoryFilter.trim() || undefined,
      });
      setRows(Array.isArray(json?.data) ? json.data : []);
      setTotal(typeof json?.total === 'number' ? json.total : 0);
    } catch (e) {
      setError(e.message || 'Falha ao carregar telemetria.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role, offset, levelFilter, categoryFilter]);

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
        <title>Telemetria técnica | Luditeca CMS</title>
      </Head>
      <Layout>
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <h1 className="mb-2 text-2xl font-bold">Telemetria técnica</h1>
          <p className="mb-6 text-sm text-gray-600">
            Erros HTTP lentos ou com falha, rotas <code className="rounded bg-gray-100 px-1">/media</code> com 4xx/5xx,
            excepções não tratadas e eventos do editor (ex.: falha de reprodução de vídeo). Latência de referência:{' '}
            <code className="rounded bg-gray-100 px-1">TELEMETRY_SLOW_MS</code> (default 3000 ms).
          </p>

          <form onSubmit={applyFilters} className="mb-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Nível</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded border px-2 py-1"
              >
                <option value="">Todos</option>
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="info">info</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Categoria (contém)</label>
              <input
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-48 rounded border px-2 py-1"
                placeholder="http, client:video…"
              />
            </div>
            <button type="submit" className="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700">
              Aplicar
            </button>
            <button
              type="button"
              className="rounded border px-4 py-1 text-sm"
              onClick={() => {
                setLevelFilter('');
                setCategoryFilter('');
                setOffset(0);
                setReloadNonce((n) => n + 1);
              }}
            >
              Limpar
            </button>
          </form>

          {error ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
          ) : null}

          {loading ? (
            <p className="text-gray-600">A carregar…</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-gray-600">
                {total} registo(s) — página {Math.floor(offset / limit) + 1}
              </p>
              <div className="overflow-x-auto rounded border bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="p-2">Data</th>
                      <th className="p-2">Nível</th>
                      <th className="p-2">Categoria</th>
                      <th className="p-2">Mensagem</th>
                      <th className="p-2">HTTP</th>
                      <th className="p-2">ms</th>
                      <th className="p-2">Utilizador</th>
                      <th className="p-2">request_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b align-top hover:bg-gray-50">
                        <td className="whitespace-nowrap p-2 text-xs text-gray-600">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-2 font-mono text-xs">{r.level}</td>
                        <td className="max-w-[10rem] truncate p-2 font-mono text-xs" title={r.category}>
                          {r.category}
                        </td>
                        <td className="max-w-md p-2 text-xs" title={r.message}>
                          {r.message}
                        </td>
                        <td className="p-2 font-mono text-xs">{r.statusCode ?? '—'}</td>
                        <td className="p-2 font-mono text-xs">{r.durationMs ?? '—'}</td>
                        <td className="max-w-[8rem] truncate p-2 text-xs">{r.userId || '—'}</td>
                        <td className="max-w-[8rem] truncate p-2 font-mono text-[10px]" title={r.requestId}>
                          {r.requestId || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={offset + limit >= total}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                  onClick={() => setOffset((o) => o + limit)}
                >
                  Seguinte
                </button>
              </div>
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
