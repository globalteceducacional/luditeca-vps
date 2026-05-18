import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Form,
  FormGroup,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Row,
  Spinner,
} from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import { getBooks, deleteBook, updateBook, searchBooks } from '../../lib/books';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import ArgonPageHeader from '../../components/argon/ArgonPageHeader';
import ArgonEmptyState from '../../components/argon/ArgonEmptyState';
import WorkflowStatusSelect, {
  WORKFLOW_LABEL,
  workflowBadgeColor,
} from '../../components/argon/WorkflowStatusSelect';
import { CMS_BOOK_CARD_CLASS } from '../../lib/cmsUiClasses';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { devLog } from '../../lib/devLog';

const PAGE_SIZE = 50;

export default function Books() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [workflowSaving, setWorkflowSaving] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [advCharacter, setAdvCharacter] = useState('');
  const [advCollection, setAdvCollection] = useState('');
  const [advKeyword, setAdvKeyword] = useState('');
  const [advLevel, setAdvLevel] = useState('');
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const latestRequestRef = useRef(0);
  const isListRefreshing = loading || deleteLoading !== null || workflowSaving !== null;

  const hasActiveSearch =
    Boolean(searchTerm.trim()) ||
    Boolean(advCharacter.trim()) ||
    Boolean(advCollection.trim()) ||
    Boolean(advKeyword.trim()) ||
    Boolean(advLevel.trim());

  const clearSearchFilters = useCallback(() => {
    setSearchTerm('');
    setAdvCharacter('');
    setAdvCollection('');
    setAdvKeyword('');
    setAdvLevel('');
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/app');
  }, [authLoading, user, router]);

  const mapBooksWithCoverUrls = (data) =>
    (data || []).map((book) => {
      let coverUrl = null;
      if (book.cover_image) {
        coverUrl = book.cover_image.startsWith('http')
          ? book.cover_image
          : getFileUrl('covers', book.cover_image);
      }
      return { ...book, coverUrl };
    });

  const loadBooksList = useCallback(async () => {
    if (!user) return;
    const requestId = Date.now() + Math.random();
    latestRequestRef.current = requestId;
    const serverSearch = hasActiveSearch;
    try {
      setLoading(true);
      setError(null);
      let data = [];
      let nextTotal = 0;
      if (!serverSearch) {
        const offset = Math.max(0, (page - 1) * PAGE_SIZE);
        const { data: rows, total: srvTotal, error: err } = await getBooks({
          limit: PAGE_SIZE,
          offset,
        });
        if (err) throw err;
        data = rows || [];
        nextTotal = typeof srvTotal === 'number' ? srvTotal : data.length;
        devLog('Livros carregados:', { count: data.length, total: nextTotal, page });
      } else {
        const { data: rows, total: srvTotal, error: err } = await searchBooks({
          q: searchTerm.trim(),
          character: advCharacter.trim() || undefined,
          collection: advCollection.trim() || undefined,
          keyword: advKeyword.trim() || undefined,
          level: advLevel.trim() || undefined,
          limit: 100,
        });
        if (err) throw err;
        data = rows || [];
        nextTotal = typeof srvTotal === 'number' ? srvTotal : data.length;
      }
      if (latestRequestRef.current !== requestId) return;
      setBooks(mapBooksWithCoverUrls(data));
      setTotal(nextTotal);
    } catch (err) {
      if (latestRequestRef.current !== requestId) return;
      console.error(err);
      setError('Falha ao carregar os livros. Por favor, tente novamente.');
    } finally {
      if (latestRequestRef.current === requestId) setLoading(false);
    }
  }, [user, hasActiveSearch, searchTerm, advCharacter, advCollection, advKeyword, advLevel, page]);

  useEffect(() => {
    if (!user) return undefined;
    const t = window.setTimeout(() => void loadBooksList(), 400);
    return () => window.clearTimeout(t);
  }, [user, loadBooksList]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, advCharacter, advCollection, advKeyword, advLevel]);

  const handleDeleteBook = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este livro? Esta ação não pode ser desfeita.')) {
      return;
    }
    try {
      setDeleteLoading(id);
      const { error: err } = await deleteBook(id);
      if (err) throw err;
      await loadBooksList();
    } catch (err) {
      const msg =
        typeof err?.message === 'string' && err.message.trim() !== ''
          ? err.message
          : 'Falha ao excluir o livro.';
      alert(msg);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleWorkflowChange = async (bookId, next) => {
    setWorkflowSaving(bookId);
    try {
      const { error: err } = await updateBook(bookId, { workflow_status: next });
      if (err) throw err;
      await loadBooksList();
    } catch (err) {
      alert(
        typeof err?.message === 'string' ? err.message : 'Não foi possível atualizar o estado editorial.',
      );
    } finally {
      setWorkflowSaving(null);
    }
  };

  if (authLoading || (!user && loading)) return null;

  return (
    <>
      <Head>
        <title>Gerenciar Livros | Luditeca CMS</title>
      </Head>
      <Layout>
        <Container fluid className="luditeca-cms-shell">
          <ArgonPageHeader
            title="Gerenciar Livros"
            subtitle="Novo livro: escolha o tipo (animado, interativo ou digital). Assistente v2 disponível nos links alternativos."
            actionLabel="Novo livro"
            actionIcon="ni ni-fat-add"
            onAction={() => router.push('/books/new')}
            actionDisabled={isListRefreshing}
          />

          <Row className="mb-4">
            <Col lg="12">
              <Card className="shadow border-0 mb-4">
                <CardHeader className="border-0">
                  <h3 className="mb-0">Pesquisar catálogo</h3>
                </CardHeader>
                <CardBody>
                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <FormGroup className="mb-3 luditeca-search-field">
                      <InputGroup className="input-group-alternative">
                        <InputGroupAddon addonType="prepend">
                          <InputGroupText>
                            <i className="fas fa-search" />
                          </InputGroupText>
                        </InputGroupAddon>
                        <Input
                          placeholder="Título, ficha, autor, categoria, palavras-chave…"
                          value={searchTerm}
                          disabled={isListRefreshing}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="luditeca-form-control"
                        />
                      </InputGroup>
                    </FormGroup>
                    <Button
                      color="link"
                      className="px-0 mb-3"
                      disabled={isListRefreshing}
                      onClick={() => setShowSearchFilters((v) => !v)}
                    >
                      {showSearchFilters ? 'Ocultar filtros' : 'Filtros avançados'}
                    </Button>
                    {showSearchFilters ? (
                      <Row>
                        <Col md="6" lg="3">
                          <FormGroup>
                            <label className="form-control-label">Personagem</label>
                            <Input
                              className="luditeca-form-control"
                              value={advCharacter}
                              disabled={isListRefreshing}
                              onChange={(e) => setAdvCharacter(e.target.value)}
                            />
                          </FormGroup>
                        </Col>
                        <Col md="6" lg="3">
                          <FormGroup>
                            <label className="form-control-label">Coleção</label>
                            <Input
                              className="luditeca-form-control"
                              value={advCollection}
                              disabled={isListRefreshing}
                              onChange={(e) => setAdvCollection(e.target.value)}
                            />
                          </FormGroup>
                        </Col>
                        <Col md="6" lg="3">
                          <FormGroup>
                            <label className="form-control-label">Palavra-chave</label>
                            <Input
                              className="luditeca-form-control"
                              value={advKeyword}
                              disabled={isListRefreshing}
                              onChange={(e) => setAdvKeyword(e.target.value)}
                            />
                          </FormGroup>
                        </Col>
                        <Col md="6" lg="3">
                          <FormGroup>
                            <label className="form-control-label">Nível</label>
                            <Input
                              className="luditeca-form-control"
                              value={advLevel}
                              disabled={isListRefreshing}
                              onChange={(e) => setAdvLevel(e.target.value)}
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                    ) : null}
                  </Form>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {error ? (
            <Alert color="danger" className="shadow">
              {error}{' '}
              <Button color="danger" size="sm" className="ml-2" onClick={() => void loadBooksList()}>
                Tentar novamente
              </Button>
            </Alert>
          ) : null}

          {loading && books.length === 0 ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
              <p className="text-muted mt-3 mb-0">A carregar livros…</p>
            </div>
          ) : null}

          {!loading && books.length === 0 ? (
            <ArgonEmptyState
              icon="ni ni-books"
              iconShape="primary"
              title={hasActiveSearch ? 'Nenhum resultado' : 'Nenhum livro no catálogo'}
              description={
                hasActiveSearch
                  ? 'Experimente outros termos ou limpe os filtros de pesquisa.'
                  : 'Crie o primeiro livro com metadados, capítulos e importação PPTX opcional.'
              }
              primaryLabel={hasActiveSearch ? undefined : 'Criar primeiro livro'}
              primaryHref={hasActiveSearch ? undefined : '/books/new'}
              secondaryLabel={hasActiveSearch ? 'Limpar pesquisa' : undefined}
              onSecondary={hasActiveSearch ? clearSearchFilters : undefined}
            />
          ) : null}

          {books.length > 0 ? (
            <>
              {loading ? (
                <Alert color="info" className="shadow-sm">
                  <Spinner size="sm" className="mr-2" /> A atualizar resultados…
                </Alert>
              ) : null}
              <Row>
                {books.map((book) => (
                  <Col key={book.id} xl="3" lg="4" md="6" className="mb-4">
                    <Card className={CMS_BOOK_CARD_CLASS}>
                      <div
                        className="card-img-top bg-secondary d-flex align-items-center justify-content-center"
                        style={{
                          height: 160,
                          backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        {!book.coverUrl ? (
                          <i className="ni ni-books text-white opacity-6" style={{ fontSize: '2rem' }} />
                        ) : null}
                      </div>
                      <CardBody className="pt-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h4 className="mb-0 text-truncate" title={book.title}>
                            {book.title || 'Sem título'}
                          </h4>
                          <Badge color={workflowBadgeColor(book.workflow_status)} pill>
                            {WORKFLOW_LABEL[book.workflow_status] || book.workflow_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted mb-1">
                          <strong>Autor:</strong> {book.authors?.name || 'Desconhecido'}
                        </p>
                        <p className="text-sm text-muted mb-3 card-text" style={{ minHeight: '2.5rem' }}>
                          {book.description || 'Sem descrição'}
                        </p>
                        <FormGroup className="mb-3">
                          <label className="form-control-label text-xs">Estado editorial</label>
                          <WorkflowStatusSelect
                            value={book.workflow_status}
                            disabled={isListRefreshing}
                            onChange={(v) => handleWorkflowChange(book.id, v)}
                          />
                          {workflowSaving === book.id ? (
                            <small className="text-primary">A guardar…</small>
                          ) : null}
                        </FormGroup>
                        <div className="d-flex justify-content-between">
                          <Button
                            color="primary"
                            size="sm"
                            outline
                            disabled={isListRefreshing}
                            onClick={() =>
                              router.push(
                                book.book_type
                                  ? `/books/${book.id}/edit-flow`
                                  : `/books/${book.id}/edit-v2`,
                              )
                            }
                          >
                            <i className="ni ni-ruler-pencil mr-1" />
                            Editar
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            outline
                            disabled={isListRefreshing || deleteLoading === book.id}
                            onClick={() => handleDeleteBook(book.id)}
                          >
                            {deleteLoading === book.id ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <i className="ni ni-fat-remove mr-1" />
                                Excluir
                              </>
                            )}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                ))}
              </Row>

              {!hasActiveSearch && total > PAGE_SIZE ? (
                <Card className="shadow">
                  <CardBody className="d-flex flex-wrap align-items-center justify-content-between">
                    <span className="text-sm text-muted mb-2 mb-md-0">
                      Mostrando {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(total, (page - 1) * PAGE_SIZE + books.length)} de {total}
                    </span>
                    <div>
                      <Button
                        color="secondary"
                        size="sm"
                        disabled={page <= 1 || isListRefreshing}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <span className="mx-3 text-sm">
                        Página {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                      </span>
                      <Button
                        color="secondary"
                        size="sm"
                        disabled={page * PAGE_SIZE >= total || isListRefreshing}
                        onClick={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
                      >
                        Seguinte
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ) : null}
            </>
          ) : null}
        </Container>
      </Layout>
    </>
  );
}
