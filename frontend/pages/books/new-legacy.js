/**
 * Assistência «novo livro» — UI legado (EditorLayout).
 * Migrado para componentes Luditeca; fluxo activo recomendado: `/books/new`.
 */
import Head from 'next/head';
import Link from 'next/link';
import { FiPlus, FiTrash2, FiUpload } from 'react-icons/fi';
import { Container } from 'reactstrap';
import EditorLayout from '../../components/EditorLayout';
import LoadingProgressOverlay from '../../components/LoadingProgressOverlay';
import BookCatalogPickers from '../../components/books/create/BookCatalogPickers';
import BookCoverUploadField from '../../components/books/create/BookCoverUploadField';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../components/argon/luditeca';
import { useNewBookWizard } from '../../hooks/useNewBookWizard';

const STEPS = ['Início', 'Metadados', 'Capítulos', 'Conteúdo'];

export default function NewBookLegacy() {
  const w = useNewBookWizard();

  if (w.authLoading) {
    return (
      <EditorLayout>
        <Head>
          <title>Novo livro (legado) | Luditeca</title>
        </Head>
        <LoadingProgressOverlay active title="Carregando" message="Verificando sua sessão..." mode="indeterminate" />
      </EditorLayout>
    );
  }

  return (
    <EditorLayout>
      <Head>
        <title>Novo livro (legado) | Luditeca</title>
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
        <LoadingProgressOverlay active title="Criando livro" message="Salvando no servidor..." mode="indeterminate" />
      ) : null}

      <Container className="py-4 luditeca-form-constrained">
        <p className="small text-muted mb-2">
          <Link href="/books/new">Usar assistente Argon (recomendado)</Link>
          {' · '}
          <Link href="/books">Catálogo</Link>
        </p>
        <div className="mb-4 text-center">
          <h1 className="h2 text-dark">Criar novo livro (legado)</h1>
          <p className="text-muted mb-0">Assistente em passos — abre o editor visual no fim.</p>
        </div>

        <div className="d-flex flex-wrap justify-content-center mb-4">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`badge badge-pill mr-2 mb-2 px-3 py-2 ${
                w.step === i ? 'badge-primary' : w.step > i ? 'badge-info' : 'badge-secondary'
              }`}
            >
              <span className="mr-1">{i + 1}</span>
              {label}
            </span>
          ))}
        </div>

        {w.error ? <LuditecaAlert color="danger">{w.error}</LuditecaAlert> : null}

        {w.step === 0 ? (
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-md-5">
              <h2 className="h4">Bem-vindo</h2>
              <p className="text-muted">
                Vai definir o título e a ficha do livro, organizar <strong>capítulos</strong> e, se quiser,
                importar um PowerPoint. No fim, abrimos o <strong>editor visual</strong>.
              </p>
              <LuditecaButton type="button" variant="primary" onClick={() => w.setStep(1)}>
                Começar
              </LuditecaButton>
            </div>
          </div>
        ) : null}

        {w.step >= 1 ? (
          <form onSubmit={w.handleSubmit} className="card shadow-sm border-0">
            <div className="card-body p-4 p-md-5">
              {w.step === 1 ? (
                <>
                  <h2 className="h4 mb-4">Metadados</h2>
                  <LuditecaInput
                    label="Título"
                    required
                    id="legacy-title"
                    value={w.title}
                    onChange={(e) => w.setTitle(e.target.value)}
                  />
                  <BookCatalogPickers
                    authorId={w.authorId}
                    categoryId={w.categoryId}
                    authors={w.authors}
                    categories={w.categories}
                    loadingAuthors={w.loadingAuthors}
                    loadingCategories={w.loadingCategories}
                    disabled={w.uploadingCover}
                    onAuthorIdChange={w.setAuthorId}
                    onCategoryIdChange={w.setCategoryId}
                  />
                  <LuditecaInput
                    label="Descrição"
                    type="textarea"
                    rows={4}
                    value={w.description}
                    onChange={(e) => w.setDescription(e.target.value)}
                  />
                  <BookCoverUploadField
                    coverUrl={w.coverImage}
                    onUpload={w.handleCoverUpload}
                    uploading={w.uploadingCover}
                    disabled={w.uploadingCover}
                  />
                </>
              ) : null}

              {w.step === 2 ? (
                <>
                  <h2 className="h4 mb-2">Capítulos</h2>
                  <p className="text-muted small mb-4">
                    Cada capítulo gera uma primeira página vazia. Se importar PPTX no passo seguinte, as páginas do
                    ficheiro passam à frente desta estrutura.
                  </p>
                  {w.chapterTitles.map((ch, i) => (
                    <div key={`ch-row-${i}`} className="d-flex align-items-start gap-2 mb-2">
                      <LuditecaInput
                        className="flex-grow-1 mb-0"
                        formGroupClassName="mb-0 flex-grow-1"
                        value={ch}
                        placeholder={`Capítulo ${i + 1}`}
                        onChange={(e) => {
                          const next = [...w.chapterTitles];
                          next[i] = e.target.value;
                          w.setChapterTitles(next);
                        }}
                      />
                      {w.chapterTitles.length > 1 ? (
                        <LuditecaButton
                          type="button"
                          variant="link"
                          className="p-0 text-danger mt-2"
                          onClick={() => w.setChapterTitles(w.chapterTitles.filter((_, j) => j !== i))}
                          title="Remover capítulo"
                        >
                          <FiTrash2 />
                        </LuditecaButton>
                      ) : null}
                    </div>
                  ))}
                  <LuditecaButton
                    type="button"
                    variant="outline"
                    outlineColor="primary"
                    size="sm"
                    className="d-inline-flex align-items-center"
                    onClick={() =>
                      w.setChapterTitles([...w.chapterTitles, `Capítulo ${w.chapterTitles.length + 1}`])
                    }
                  >
                    <FiPlus className="mr-1" />
                    Adicionar capítulo
                  </LuditecaButton>
                </>
              ) : null}

              {w.step === 3 ? (
                <>
                  <h2 className="h4 mb-2">Conteúdo inicial</h2>
                  <p className="text-muted small mb-4">
                    Opcional: importe um PowerPoint para criar várias páginas de uma vez.
                  </p>
                  <label className="d-inline-block mb-0">
                    <LuditecaButton
                      variant="primary"
                      tag="span"
                      disabled={w.importingPptx}
                      className="d-inline-flex align-items-center"
                    >
                      <FiUpload className="mr-2" />
                      {w.importingPptx ? 'A importar…' : 'Selecionar PPTX'}
                    </LuditecaButton>
                    <input
                      type="file"
                      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      className="d-none"
                      onChange={w.handlePptxImport}
                      disabled={w.importingPptx}
                    />
                  </label>
                  {w.importedPages.length > 0 ? (
                    <LuditecaAlert color="success" className="mt-3 mb-0">
                      {w.importedPages.length} páginas importadas
                    </LuditecaAlert>
                  ) : null}
                </>
              ) : null}

              <div className="d-flex flex-wrap justify-content-between align-items-center mt-4 pt-4 border-top">
                <LuditecaButton type="button" variant="outline" onClick={w.goBackStep}>
                  {w.step === 1 ? '← Início' : '← Anterior'}
                </LuditecaButton>
                {w.step < 3 ? (
                  <LuditecaButton type="submit" variant="primary">
                    Seguinte
                  </LuditecaButton>
                ) : (
                  <LuditecaButton
                    type="submit"
                    variant="success"
                    disabled={w.loading}
                    loading={w.loading}
                    loadingLabel="A criar…"
                  >
                    Criar livro e abrir editor
                  </LuditecaButton>
                )}
              </div>
            </div>
          </form>
        ) : null}
      </Container>
    </EditorLayout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
