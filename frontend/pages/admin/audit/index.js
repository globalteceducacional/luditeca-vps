import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card, CardBody, Col, Form, Row, Spinner, Table } from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../../components/argon/luditeca';
import { useAuth } from '../../../contexts/auth';
import { ROLES } from '../../../lib/roles';
import { downloadAuditLogsCsv, fetchAuditLogs } from '../../../lib/auditLogs';

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
  const [exporting, setExporting] = useState(false);
  const limit = 40;

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadAuditLogsCsv({
        book_id: bookIdFilter.trim() || undefined,
        action_code: actionFilter.trim() || undefined,
      });
    } catch (e) {
      setError(e.message || 'Falha ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

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

  const clearFilters = () => {
    setBookIdFilter('');
    setActionFilter('');
    setOffset(0);
    setReloadNonce((n) => n + 1);
  };

  return (
    <Layout>
      <Head>
        <title>Trilha de ações | Luditeca</title>
      </Head>
      <ArgonCmsShell
        contentConstrained
        title="Trilha de ações"
        subtitle="Eventos EVT:* com utilizador e alvo BOOK:/USER:."
        headerExtra={
          <LuditecaButton variant="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </LuditecaButton>
        }
      >
        <Card className="shadow border-0 mb-4">
          <CardBody>
            <Form onSubmit={applyFilters}>
              <Row>
                <Col md="3">
                  <LuditecaInput
                    label="Livro (id)"
                    value={bookIdFilter}
                    onChange={(e) => setBookIdFilter(e.target.value)}
                    placeholder="ex: 12"
                  />
                </Col>
                <Col md="4">
                  <LuditecaInput
                    label="Código / texto"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    placeholder="EVT:BOOK"
                  />
                </Col>
                <Col md="5" className="d-flex align-items-end flex-wrap pb-3">
                  <LuditecaButton variant="primary" type="submit" className="mr-2 mb-2">
                    Aplicar
                  </LuditecaButton>
                  <LuditecaButton variant="outline" type="button" className="mr-2 mb-2" onClick={clearFilters}>
                    Limpar
                  </LuditecaButton>
                  <LuditecaButton
                    variant="info"
                    type="button"
                    className="mb-2"
                    disabled={exporting}
                    loading={exporting}
                    onClick={handleExportCsv}
                  >
                    Exportar CSV
                  </LuditecaButton>
                </Col>
              </Row>
            </Form>
          </CardBody>
        </Card>
        {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
        <ArgonTableCard title="Registos">
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table className="align-items-center table-flush" size="sm">
                  <thead className="thead-light">
                    <tr>
                      <th>Data</th>
                      <th>Código</th>
                      <th>Ator</th>
                      <th>Alvo</th>
                      <th>Livro</th>
                      <th>Página</th>
                      <th>Metadados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-0 border-0">
                          <ArgonEmptyState
                            variant="inline"
                            icon="ni ni-paper-diploma"
                            iconShape="secondary"
                            title="Sem registos"
                            description="Não há entradas de auditoria para os filtros atuais."
                            secondaryLabel="Limpar filtros"
                            onSecondary={clearFilters}
                          />
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id}>
                          <td className="text-nowrap">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                          </td>
                          <td className="font-monospace small">{r.actionCode}</td>
                          <td className="small text-break">{r.actorUserId || '—'}</td>
                          <td className="small text-break">
                            {r.targetType && r.targetId ? `${r.targetType}: ${r.targetId}` : r.targetId || '—'}
                          </td>
                          <td>{r.bookId != null ? String(r.bookId) : '—'}</td>
                          <td className="small">{r.pageRef || '—'}</td>
                          <td className="small text-truncate" style={{ maxWidth: 200 }} title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                            {r.metadata ? JSON.stringify(r.metadata) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-3">
                <span className="text-muted small">
                  Total: {total} · Mostrando {offset + 1}–{Math.min(offset + rows.length, offset + limit)}
                </span>
                <div>
                  <LuditecaButton
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    className="mr-2"
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  >
                    Anterior
                  </LuditecaButton>
                  <LuditecaButton
                    variant="outline"
                    size="sm"
                    disabled={offset + rows.length >= total}
                    onClick={() => setOffset((o) => o + limit)}
                  >
                    Seguinte
                  </LuditecaButton>
                </div>
              </div>
            </>
          )}
        </ArgonTableCard>
      </ArgonCmsShell>
    </Layout>
  );
}
