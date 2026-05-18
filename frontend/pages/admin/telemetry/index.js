import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormGroup,
  Input,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonEmptyState from '../../../components/argon/ArgonEmptyState';
import ArgonCmsShell, { ArgonTableCard } from '../../../components/argon/ArgonCmsShell';
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
    <Layout>
      <Head>
        <title>Telemetria técnica | Luditeca</title>
      </Head>
      <ArgonCmsShell
        title="Telemetria técnica"
        subtitle="Erros HTTP, rotas /media e eventos do editor."
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/admin" className="p-0">
            ← Hub admin
          </Button>
        }
      >
        <Card className="shadow border-0 mb-4">
          <CardBody>
            <Form onSubmit={applyFilters}>
              <Row>
                <Col md="3">
                  <FormGroup>
                    <label className="form-control-label">Nível</label>
                    <Input
                      type="select"
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option value="error">error</option>
                      <option value="warn">warn</option>
                      <option value="info">info</option>
                    </Input>
                  </FormGroup>
                </Col>
                <Col md="4">
                  <FormGroup>
                    <label className="form-control-label">Categoria (contém)</label>
                    <Input
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      placeholder="http, client:video…"
                    />
                  </FormGroup>
                </Col>
                <Col md="5" className="d-flex align-items-end">
                  <Button color="primary" type="submit" className="mr-2">
                    Aplicar
                  </Button>
                  <Button
                    color="secondary"
                    type="button"
                    onClick={() => {
                      setLevelFilter('');
                      setCategoryFilter('');
                      setOffset(0);
                      setReloadNonce((n) => n + 1);
                    }}
                  >
                    Limpar
                  </Button>
                </Col>
              </Row>
            </Form>
          </CardBody>
        </Card>
        {error ? <Alert color="danger">{error}</Alert> : null}
        <ArgonTableCard title="Registos">
          {loading ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : (
            <>
              <p className="text-muted small mb-3">
                {total} registo(s) — página {Math.floor(offset / limit) + 1}
              </p>
              <div className="table-responsive">
                <Table className="align-items-center table-flush" size="sm">
                  <thead className="thead-light">
                    <tr>
                      <th>Data</th>
                      <th>Nível</th>
                      <th>Categoria</th>
                      <th>Mensagem</th>
                      <th>HTTP</th>
                      <th>ms</th>
                      <th>Utilizador</th>
                      <th>request_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-0 border-0">
                          <ArgonEmptyState
                            variant="inline"
                            icon="ni ni-chart-bar-32"
                            iconShape="secondary"
                            title="Sem registos"
                            description="Não há eventos de telemetria para estes filtros ou período."
                            secondaryLabel="Limpar filtros"
                            onSecondary={() => {
                              setLevelFilter('');
                              setCategoryFilter('');
                              setOffset(0);
                              setReloadNonce((n) => n + 1);
                            }}
                          />
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id}>
                          <td className="text-nowrap small text-muted">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                          </td>
                          <td className="font-monospace small">{r.level}</td>
                          <td className="small text-truncate" style={{ maxWidth: 120 }} title={r.category}>
                            {r.category}
                          </td>
                          <td className="small" style={{ maxWidth: 280 }} title={r.message}>
                            {r.message}
                          </td>
                          <td className="font-monospace small">{r.statusCode ?? '—'}</td>
                          <td className="font-monospace small">{r.durationMs ?? '—'}</td>
                          <td className="small text-truncate" style={{ maxWidth: 100 }}>
                            {r.userId || '—'}
                          </td>
                          <td className="font-monospace small text-truncate" style={{ maxWidth: 100 }} title={r.requestId}>
                            {r.requestId || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
              <div className="mt-3">
                <Button
                  color="default"
                  size="sm"
                  disabled={offset === 0}
                  className="mr-2"
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                >
                  Anterior
                </Button>
                <Button
                  color="default"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset((o) => o + limit)}
                >
                  Seguinte
                </Button>
              </div>
            </>
          )}
        </ArgonTableCard>
      </ArgonCmsShell>
    </Layout>
  );
}
