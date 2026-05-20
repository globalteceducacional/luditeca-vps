import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  CustomInput,
  Nav,
  NavItem,
  NavLink,
  Row,
  Spinner,
  Table,
  TabContent,
  TabPane,
} from 'reactstrap';
import { toast } from 'react-hot-toast';
import Layout from '../../components/Layout';
import ArgonEmptyState from '../../components/argon/ArgonEmptyState';
import ArgonPageHeader from '../../components/argon/ArgonPageHeader';
import WorkflowStatusSelect, {
  WORKFLOW_LABEL,
  workflowBadgeColor,
} from '../../components/argon/WorkflowStatusSelect';
import { useAuth } from '../../contexts/auth';
import { listActivities, updateActivity } from '../../lib/activities';
import { getBooks, updateBook } from '../../lib/books';
import { listColoringPages, updateColoringPage } from '../../lib/coloringPages';
import { listLibrasLessons } from '../../lib/librasLessons';
import { listPuzzleGames, updatePuzzleGame } from '../../lib/puzzleGames';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { bookTypeBadgeColor, getBookEditHref, getBookTypeLabel } from '../../lib/bookTypes';

const TABS = [
  { id: 'books', label: 'LIVROS', icon: 'ni ni-book-bookmark' },
  { id: 'libras', label: 'LIBRAS', icon: 'ni ni-app' },
  { id: 'activities', label: 'ATIVIDADES', icon: 'ni ni-bullet-list-67' },
  { id: 'puzzle', label: 'QUEBRA-CABEÇA', icon: 'ni ni-app' },
  { id: 'coloring', label: 'PINTURAS', icon: 'ni ni-image' },
];

function authorName(book) {
  return book?.authors?.name || book?.author || '—';
}

function PublishToggle({ id, checked, disabled, onChange, labelOn = 'Na app', labelOff = 'Rascunho' }) {
  return (
    <CustomInput
      type="switch"
      id={id}
      checked={!!checked}
      disabled={disabled}
      onChange={onChange}
      label={checked ? labelOn : labelOff}
    />
  );
}

export default function AdminHub() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('books');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [books, setBooks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [libras, setLibras] = useState([]);
  const [puzzles, setPuzzles] = useState([]);
  const [coloring, setColoring] = useState([]);
  const [workflowSaving, setWorkflowSaving] = useState(null);
  const [publishSaving, setPublishSaving] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const loadTab = useCallback(async () => {
    if (!user || !isRole(user, CMS_ROLES)) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'books') {
        const { data, error: err } = await getBooks({ limit: 50, offset: 0 });
        if (err) throw new Error(err.message);
        setBooks(data || []);
      } else if (tab === 'activities') {
        const { data, error: err } = await listActivities({ limit: 50 });
        if (err) throw new Error(err.message);
        setActivities(data || []);
      } else if (tab === 'libras') {
        const { data, error: err } = await listLibrasLessons({ limit: 50 });
        if (err) throw new Error(err.message);
        setLibras(data || []);
      } else if (tab === 'puzzle') {
        const { data, error: err } = await listPuzzleGames({ limit: 50 });
        if (err) throw new Error(err.message);
        setPuzzles(data || []);
      } else if (tab === 'coloring') {
        const { data, error: err } = await listColoringPages({ limit: 50 });
        if (err) throw new Error(err.message);
        setColoring(data || []);
      }
    } catch (e) {
      setError(e.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const handleWorkflowChange = async (bookId, next) => {
    setWorkflowSaving(bookId);
    try {
      const { error: err } = await updateBook(bookId, { workflow_status: next });
      if (err) throw new Error(err.message);
      setBooks((prev) =>
        prev.map((b) => (String(b.id) === String(bookId) ? { ...b, workflow_status: next } : b)),
      );
      toast.success('Estado editorial atualizado.');
    } catch (e) {
      toast.error(e.message || 'Não foi possível atualizar o livro.');
    } finally {
      setWorkflowSaving(null);
    }
  };

  const togglePublished = async (kind, id, current) => {
    const key = `${kind}:${id}`;
    setPublishSaving(key);
    const next = !current;
    try {
      if (kind === 'activity') {
        const { error: err } = await updateActivity(id, { is_published: next });
        if (err) throw new Error(err.message);
        setActivities((prev) => prev.map((r) => (r.id === id ? { ...r, is_published: next } : r)));
      } else if (kind === 'puzzle') {
        const { error: err } = await updatePuzzleGame(id, { is_published: next });
        if (err) throw new Error(err.message);
        setPuzzles((prev) => prev.map((r) => (r.id === id ? { ...r, is_published: next } : r)));
      } else if (kind === 'coloring') {
        const { error: err } = await updateColoringPage(id, { is_published: next });
        if (err) throw new Error(err.message);
        setColoring((prev) => prev.map((r) => (r.id === id ? { ...r, is_published: next } : r)));
      }
      toast.success(next ? 'Publicado na app.' : 'Removido da app.');
    } catch (e) {
      toast.error(e.message || 'Falha ao atualizar publicação.');
    } finally {
      setPublishSaving(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>Área Admin | Luditeca</title>
      </Head>
      <Container fluid className="luditeca-cms-shell">
        <ArgonPageHeader
          title="Área do Administrador"
          subtitle="Gestão de conteúdo educativo: livros, atividades, libras, puzzle e pinturas."
        >
          {user.role === 'admin' ? (
            <>
              <Button color="default" size="sm" outline tag={Link} href="/admin/users" className="mr-2 mb-2">
                Utilizadores
              </Button>
              <Button color="default" size="sm" outline tag={Link} href="/admin/audit" className="mr-2 mb-2">
                Trilha
              </Button>
              <Button color="default" size="sm" outline tag={Link} href="/admin/telemetry" className="mb-2">
                Telemetria
              </Button>
            </>
          ) : null}
        </ArgonPageHeader>

        <Row>
          <Col>
            <Card className="shadow border-0">
              <CardHeader className="border-0 pb-0">
                <div className="admin-hub-tabs-scroll">
                  <Nav pills className="flex-row flex-nowrap">
                    {TABS.map((t) => (
                      <NavItem key={t.id} className="flex-shrink-0">
                        <NavLink
                          className={tab === t.id ? 'active' : ''}
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setTab(t.id);
                          }}
                        >
                          <i className={`${t.icon} mr-2`} />
                          {t.label}
                        </NavLink>
                      </NavItem>
                    ))}
                  </Nav>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                {error ? (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                ) : null}
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner color="primary" />
                    <p className="text-muted mt-2 mb-0">A carregar…</p>
                  </div>
                ) : (
                  <TabContent activeTab={tab}>
                    <TabPane tabId="books">
                      <div className="d-flex justify-content-end mb-3">
                        <Button color="primary" size="sm" tag={Link} href="/books/new">
                          <i className="ni ni-fat-add mr-1" />
                          Novo livro
                        </Button>
                      </div>
                      <div className="table-responsive">
                        <Table className="align-items-center table-flush" hover>
                          <thead className="thead-light">
                            <tr>
                              <th scope="col">Título</th>
                              <th scope="col">Tipo</th>
                              <th scope="col">Autor</th>
                              <th scope="col">Estado</th>
                              <th scope="col" />
                            </tr>
                          </thead>
                          <tbody>
                            {books.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-0 border-0">
                                  <ArgonEmptyState
                                    variant="inline"
                                    icon="ni ni-book-bookmark"
                                    iconShape="info"
                                    title="Nenhum livro"
                                    description="Crie um livro ou abra o editor para continuar o trabalho."
                                    primaryLabel="Novo livro"
                                    primaryHref="/books/new"
                                  />
                                </td>
                              </tr>
                            ) : (
                              books.map((b) => (
                                <tr key={b.id}>
                                  <th scope="row">
                                    <span className="font-weight-bold mb-0">{b.title}</span>
                                  </th>
                                  <td>
                                    {b.book_type ? (
                                      <Badge color={bookTypeBadgeColor(b.book_type)} pill>
                                        {getBookTypeLabel(b.book_type)}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted text-sm">Editor v2</span>
                                    )}
                                  </td>
                                  <td>{authorName(b)}</td>
                                  <td style={{ minWidth: 160 }}>
                                    <WorkflowStatusSelect
                                      value={b.workflow_status}
                                      disabled={workflowSaving === b.id}
                                      onChange={(v) => handleWorkflowChange(b.id, v)}
                                    />
                                    <Badge
                                      color={workflowBadgeColor(b.workflow_status)}
                                      className="mt-1"
                                    >
                                      {WORKFLOW_LABEL[b.workflow_status] || b.workflow_status}
                                    </Badge>
                                  </td>
                                  <td className="text-right">
                                    <Button
                                      color="primary"
                                      size="sm"
                                      outline
                                      tag={Link}
                                      href={getBookEditHref(b)}
                                    >
                                      Editar
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </Table>
                      </div>
                      <p className="text-muted text-sm mt-3 mb-0">
                        Livros <strong>Publicado</strong> aparecem em /app/library.
                      </p>
                    </TabPane>

                    <TabPane tabId="libras">
                      <div className="mb-3">
                        <Button color="primary" size="sm" tag={Link} href="/admin/libras/new/edit" className="mr-2">
                          Nova lição
                        </Button>
                        <Button color="secondary" size="sm" outline tag={Link} href="/admin/libras">
                          Gestão completa
                        </Button>
                      </div>
                      <Table className="align-items-center table-flush" responsive hover>
                        <thead className="thead-light">
                          <tr>
                            <th>Palavra</th>
                            <th>Ordem</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {libras.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-0 border-0">
                                <ArgonEmptyState
                                  variant="inline"
                                  icon="ni ni-app"
                                  iconShape="info"
                                  title="Nenhuma lição LIBRAS"
                                  description="Adicione lições para aparecerem na app."
                                  primaryLabel="Nova lição"
                                  primaryHref="/admin/libras/new/edit"
                                  secondaryLabel="Gestão completa"
                                  secondaryHref="/admin/libras"
                                />
                              </td>
                            </tr>
                          ) : (
                            libras.map((row) => (
                              <tr key={row.id}>
                                <th scope="row">{row.word}</th>
                                <td>{row.sort_order}</td>
                                <td className="text-right">
                                  <Button
                                    size="sm"
                                    color="primary"
                                    outline
                                    tag={Link}
                                    href={`/admin/libras/${row.id}/edit`}
                                  >
                                    Editar
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </TabPane>

                    <TabPane tabId="activities">
                      <div className="mb-3">
                        <Button
                          color="primary"
                          size="sm"
                          tag={Link}
                          href="/admin/activities/new/edit"
                          className="mr-2"
                        >
                          Nova atividade
                        </Button>
                        <Button color="secondary" size="sm" outline tag={Link} href="/admin/activities">
                          Gestão completa
                        </Button>
                      </div>
                      <Table className="align-items-center table-flush" responsive hover>
                        <thead className="thead-light">
                          <tr>
                            <th>Título</th>
                            <th>Tipo</th>
                            <th>App</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {activities.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-0 border-0">
                                <ArgonEmptyState
                                  variant="inline"
                                  icon="ni ni-bullet-list-67"
                                  iconShape="info"
                                  title="Nenhuma atividade"
                                  description="Crie quizzes e jogos para o espaço da app."
                                  primaryLabel="Nova atividade"
                                  primaryHref="/admin/activities/new/edit"
                                  secondaryLabel="Gestão completa"
                                  secondaryHref="/admin/activities"
                                />
                              </td>
                            </tr>
                          ) : (
                            activities.map((row) => (
                              <tr key={row.id}>
                                <th scope="row">{row.title}</th>
                                <td>
                                  <Badge color="info">{row.type}</Badge>
                                </td>
                                <td>
                                  <PublishToggle
                                    id={`act-${row.id}`}
                                    checked={row.is_published}
                                    disabled={publishSaving === `activity:${row.id}`}
                                    onChange={() => togglePublished('activity', row.id, row.is_published)}
                                  />
                                </td>
                                <td className="text-right">
                                  <Button
                                    size="sm"
                                    color="primary"
                                    outline
                                    tag={Link}
                                    href={`/admin/activities/${row.id}/edit`}
                                  >
                                    Editar
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </TabPane>

                    <TabPane tabId="puzzle">
                      <div className="mb-3">
                        <Button color="secondary" size="sm" outline tag={Link} href="/admin/puzzle">
                          Gestão completa
                        </Button>
                      </div>
                      <Table className="align-items-center table-flush" responsive hover>
                        <thead className="thead-light">
                          <tr>
                            <th>Título</th>
                            <th>Peças</th>
                            <th>App</th>
                          </tr>
                        </thead>
                        <tbody>
                          {puzzles.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-0 border-0">
                                <ArgonEmptyState
                                  variant="inline"
                                  icon="ni ni-app"
                                  iconShape="info"
                                  title="Nenhum quebra-cabeça"
                                  description="Configure jogos na área de gestão."
                                  primaryLabel="Abrir gestão"
                                  primaryHref="/admin/puzzle"
                                />
                              </td>
                            </tr>
                          ) : (
                            puzzles.map((row) => (
                              <tr key={row.id}>
                                <th scope="row">{row.title}</th>
                                <td>{row.piece_count}</td>
                                <td>
                                  <PublishToggle
                                    id={`puz-${row.id}`}
                                    checked={row.is_published}
                                    disabled={publishSaving === `puzzle:${row.id}`}
                                    onChange={() => togglePublished('puzzle', row.id, row.is_published)}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </TabPane>

                    <TabPane tabId="coloring">
                      <div className="mb-3">
                        <Button color="secondary" size="sm" outline tag={Link} href="/admin/coloring">
                          Gestão completa
                        </Button>
                      </div>
                      <Table className="align-items-center table-flush" responsive hover>
                        <thead className="thead-light">
                          <tr>
                            <th>Título</th>
                            <th>App</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coloring.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-0 border-0">
                                <ArgonEmptyState
                                  variant="inline"
                                  icon="ni ni-image"
                                  iconShape="info"
                                  title="Nenhuma pintura"
                                  description="Adicione páginas para colorir na gestão."
                                  primaryLabel="Abrir gestão"
                                  primaryHref="/admin/coloring"
                                />
                              </td>
                            </tr>
                          ) : (
                            coloring.map((row) => (
                              <tr key={row.id}>
                                <th scope="row">{row.title}</th>
                                <td>
                                  <PublishToggle
                                    id={`col-${row.id}`}
                                    checked={row.is_published}
                                    disabled={publishSaving === `coloring:${row.id}`}
                                    onChange={() =>
                                      togglePublished('coloring', row.id, row.is_published)
                                    }
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </TabPane>
                  </TabContent>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </Layout>
  );
}
