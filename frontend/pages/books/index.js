import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Badge,
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
import { BookCatalogGridSkeleton } from '../../components/argon/LuditecaSkeleton';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../components/argon/luditeca';
import { useAuth } from '../../contexts/auth';
import { getBooks, deleteBook, updateBook, searchBooks } from '../../lib/books';
import { getFileUrl } from '../../lib/mediaUrl';
import Layout from '../../components/Layout';
import ArgonBreadcrumbs from '../../components/argon/ArgonBreadcrumbs';
import ArgonFormCard from '../../components/argon/ArgonFormCard';
import ArgonPageHeader from '../../components/argon/ArgonPageHeader';
import { buildCmsBreadcrumbs } from '../../lib/cmsBreadcrumbs';
import ArgonEmptyState from '../../components/argon/ArgonEmptyState';
import WorkflowStatusSelect, {
  WORKFLOW_LABEL,
  workflowBadgeColor,
} from '../../components/argon/WorkflowStatusSelect';
import { CMS_BOOK_CARD_CLASS } from '../../lib/cmsUiClasses';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { devLog } from '../../lib/devLog';
import { bookTypeBadgeColor, getBookEditHref, getBookTypeLabel } from '../../lib/bookTypes';

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
        <Container fluid className="luditeca-cms-shell luditeca-content-constrained">
          <ArgonBreadcrumbs items={buildCmsBreadcrumbs('/books')} />
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
              <ArgonFormCard title="Pesquisar catálogo" className="mb-4">
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
                    <LuditecaButton
                      variant="link"
                      className="px-0 mb-3"
                      disabled={isListRefreshing}
                      onClick={() => setShowSearchFilters((v) => !v)}
                    >
                      {showSearchFilters ? 'Ocultar filtros' : 'Filtros avançados'}
                    </LuditecaButton>
                    {showSearchFilters ? (
                      <Row>
                        <Col md="6" lg="3">
                          <LuditecaInput
                            label="Personagem"
                            value={advCharacter}
                            disabled={isListRefreshing}
                            onChange={(e) => setAdvCharacter(e.target.value)}
                          />
                        </Col>
                        <Col md="6" lg="3">
                          <LuditecaInput
                            label="Coleção"
                            value={advCollection}
                            disabled={isListRefreshing}
                            onChange={(e) => setAdvCollection(e.target.value)}
                          />
                        </Col>
                        <Col md="6" lg="3">
                          <LuditecaInput
                            label="Palavra-chave"
                            value={advKeyword}
                            disabled={isListRefreshing}
                            onChange={(e) => setAdvKeyword(e.target.value)}
                          />
                        </Col>
                        <Col md="6" lg="3">
                          <LuditecaInput
                            label="Nível"
                            value={advLevel}
                            disabled={isListRefreshing}
                            onChange={(e) => setAdvLevel(e.target.value)}
                          />
                        </Col>
                      </Row>
                    ) : null}
                  </Form>
              </ArgonFormCard>
            </Col>
          </Row>

          {error ? (
            <LuditecaAlert color="danger" className="shadow">
              {error}{' '}
              <LuditecaButton variant="danger" size="sm" className="ml-2" onClick={() => void loadBooksList()}>
                Tentar novamente
              </LuditecaButton>
            </LuditecaAlert>
          ) : null}

          {loading && books.length === 0 ? <BookCatalogGridSkeleton count={8} /> : null}

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
                <div className="luditeca-refresh-bar" role="status" aria-live="polite">
                  <div className="luditeca-refresh-bar-inner" />
                  <span className="sr-only">A atualizar resultados…</span>
                </div>
              ) : null}
              <Row className={loading ? 'luditeca-content-refreshing' : undefined}>
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
                          <h4 className="mb-0 text-truncate pr-2" title={book.title}>
                            {book.title || 'Sem título'}
                          </h4>
                          <div className="d-flex flex-column align-items-end flex-shrink-0">
                            {book.book_type ? (
                              <Badge
                                color={bookTypeBadgeColor(book.book_type)}
                                pill
                                className="mb-1"
                              >
                                {getBookTypeLabel(book.book_type)}
                              </Badge>
                            ) : null}
                            <Badge color={workflowBadgeColor(book.workflow_status)} pill>
                              {WORKFLOW_LABEL[book.workflow_status] || book.workflow_status}
                            </Badge>
                          </div>
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
                          <LuditecaButton
                            variant="outline"
                            outlineColor="primary"
                            size="sm"
                            icon="ni ni-ruler-pencil"
                            disabled={isListRefreshing}
                            onClick={() => router.push(getBookEditHref(book))}
                          >
                            Editar
                          </LuditecaButton>
                          <LuditecaButton
                            variant="outline"
                            outlineColor="danger"
                            size="sm"
                            icon="ni ni-fat-remove"
                            disabled={isListRefreshing || deleteLoading === book.id}
                            loading={deleteLoading === book.id}
                            onClick={() => handleDeleteBook(book.id)}
                          >
                            Excluir
                          </LuditecaButton>
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
                      <LuditecaButton
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || isListRefreshing}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </LuditecaButton>
                      <span className="mx-3 text-sm">
                        Página {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                      </span>
                      <LuditecaButton
                        variant="outline"
                        size="sm"
                        disabled={page * PAGE_SIZE >= total || isListRefreshing}
                        onClick={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
                      >
                        Seguinte
                      </LuditecaButton>
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
