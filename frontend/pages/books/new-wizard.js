import Head from 'next/head';
import Link from 'next/link';
import { FiUpload } from 'react-icons/fi';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormGroup,
  Input,
  Row,
} from 'reactstrap';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../components/argon/ArgonFormCard';
import LoadingProgressOverlay from '../../components/LoadingProgressOverlay';
import BookCreateMetadata from '../../components/books/create/BookCreateMetadata';
import { useNewBookWizard } from '../../hooks/useNewBookWizard';

const STEP_LABELS = ['Início', 'Metadados', 'Capítulos', 'Conteúdo'];

/** Assistente capítulos/PPTX → editor v2 (`/books/new-wizard`). */
export default function NewBookWizardPage() {
  const w = useNewBookWizard();

  if (w.authLoading || !w.user) {
    return (
      <Layout>
        <Head>
          <title>Novo livro | Luditeca CMS</title>
        </Head>
        <ArgonCmsShell title="Novo livro" loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Novo livro | Luditeca CMS</title>
      </Head>

      {w.importingPptx ? (
        <LoadingProgressOverlay
          active
          title="Importando..."
          message={w.pptxImportProgress?.message || 'Processando...'}
          compact
          showFooterHint={false}
          mode={typeof w.pptxImportProgress?.percent === 'number' ? 'determinate' : 'indeterminate'}
          percent={typeof w.pptxImportProgress?.percent === 'number' ? w.pptxImportProgress.percent : 0}
        />
      ) : null}

      {w.loading ? (
        <LoadingProgressOverlay active title="Criando livro" message="A guardar no servidor…" mode="indeterminate" />
      ) : null}

      <ArgonCmsShell
        title="Assistente — novo livro"
        subtitle="Assistente em passos (Argon). Metadados, capítulos e importação PPTX opcional; depois abre o editor v2."
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/books" className="p-0">
            ← Catálogo
          </Button>
        }
      >
        <Row className="justify-content-center">
          <Col lg="10" xl="8">
            <div className="d-flex flex-wrap justify-content-center mb-4">
              {STEP_LABELS.map((label, i) => (
                <Badge
                  key={label}
                  color={w.step === i ? 'primary' : w.step > i ? 'info' : 'secondary'}
                  pill
                  className="mr-2 mb-2 px-3 py-2 font-weight-bold"
                >
                  <span className="mr-1">{i + 1}</span>
                  {label}
                </Badge>
              ))}
            </div>

            {w.error ? <Alert color="danger">{w.error}</Alert> : null}

            {w.step === 0 ? (
              <ArgonFormCard title="Bem-vindo">
                <p className="text-muted mb-4">
                  Define a ficha do livro e os <strong>capítulos</strong>. Opcionalmente importa um PowerPoint. No fim,
                  abrimos o <strong>editor visual</strong> para continuar as páginas.
                </p>
                <Button color="primary" className="luditeca-btn-gradient" type="button" onClick={() => w.setStep(1)}>
                  Começar
                </Button>
              </ArgonFormCard>
            ) : null}

            {w.step >= 1 ? (
              <Card className="shadow border-0 luditeca-form-card">
                <CardBody>
                  <Form onSubmit={w.handleSubmit}>
                    {w.step === 1 ? (
                      <>
                        <h4 className="mb-4 text-dark font-weight-bold">Metadados</h4>
                        <BookCreateMetadata
                          form={{
                            title: w.title,
                            description: w.description,
                            age_range: '',
                            author_id: w.authorId,
                            category_id: w.categoryId,
                            cover_image: w.coverImage,
                            workflow_status: 'draft',
                          }}
                          onChange={w.patchWizardForm}
                          authors={w.authors}
                          categories={w.categories}
                          onAuthorCreated={w.onAuthorCreated}
                          onCategoryCreated={w.onCategoryCreated}
                          loadingAuthors={w.loadingAuthors}
                          loadingCategories={w.loadingCategories}
                          onCoverUpload={w.handleCoverUpload}
                          uploadingCover={w.uploadingCover}
                          showAgeRange={false}
                          showWorkflow={false}
                        />
                      </>
                    ) : null}

                    {w.step === 2 ? (
                      <>
                        <h4 className="mb-2 text-dark font-weight-bold">Capítulos</h4>
                        <p className="text-muted small mb-4">
                          Cada capítulo gera uma primeira página no livro. Se importar PPTX no passo seguinte, esse conteúdo
                          substitui esta estrutura inicial.
                        </p>
                        {w.chapterTitles.map((ch, i) => (
                          <FormGroup key={`ch-${i}`} className="d-flex flex-wrap align-items-center">
                            <Input
                              className="luditeca-form-control flex-grow-1 mr-2 mb-2 mb-md-0"
                              style={{ minWidth: 200 }}
                              value={ch}
                              onChange={(e) => {
                                const next = [...w.chapterTitles];
                                next[i] = e.target.value;
                                w.setChapterTitles(next);
                              }}
                              placeholder={`Capítulo ${i + 1}`}
                            />
                            {w.chapterTitles.length > 1 ? (
                              <Button
                                color="danger"
                                outline
                                size="sm"
                                type="button"
                                className="mb-2 mb-md-0"
                                onClick={() => w.setChapterTitles(w.chapterTitles.filter((_, j) => j !== i))}
                              >
                                Remover
                              </Button>
                            ) : null}
                          </FormGroup>
                        ))}
                        <Button
                          color="secondary"
                          outline
                          size="sm"
                          type="button"
                          onClick={() => w.setChapterTitles([...w.chapterTitles, `Capítulo ${w.chapterTitles.length + 1}`])}
                        >
                          + Adicionar capítulo
                        </Button>
                      </>
                    ) : null}

                    {w.step === 3 ? (
                      <>
                        <h4 className="mb-2 text-dark font-weight-bold">Conteúdo inicial</h4>
                        <p className="text-muted small mb-4">
                          Opcional: importe um PowerPoint. Sem importação, usamos os capítulos (uma página por capítulo).
                        </p>
                        <FormGroup>
                          <label className={`btn btn-primary mb-0 luditeca-btn-gradient ${w.importingPptx ? 'disabled' : ''}`}>
                            <FiUpload className="mr-2" />
                            {w.importingPptx ? 'A importar…' : 'Selecionar PPTX'}
                            <input
                              type="file"
                              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                              className="d-none"
                              onChange={w.handlePptxImport}
                              disabled={w.importingPptx}
                            />
                          </label>
                          {w.importedPages.length > 0 ? (
                            <span className="small text-success ml-3 font-weight-bold">
                              {w.importedPages.length} páginas importadas
                            </span>
                          ) : null}
                        </FormGroup>
                      </>
                    ) : null}

                    <div className="d-flex flex-wrap justify-content-between align-items-center border-top pt-4 mt-4">
                      <Button color="secondary" outline type="button" onClick={w.goBackStep}>
                        {w.step === 1 ? '← Início' : '← Anterior'}
                      </Button>
                      {w.step < 3 ? (
                        <Button color="primary" type="submit" className="luditeca-btn-gradient">
                          Seguinte
                        </Button>
                      ) : (
                        <Button color="success" type="submit" disabled={w.loading}>
                          {w.loading ? 'A criar…' : 'Criar livro e abrir editor'}
                        </Button>
                      )}
                    </div>
                  </Form>
                </CardBody>
              </Card>
            ) : null}
          </Col>
        </Row>
      </ArgonCmsShell>
    </Layout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
