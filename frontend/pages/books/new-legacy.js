/**
 * Assistência «novo livro» — UI legado (EditorLayout + Tailwind).
 * Mantido para referência / recuperação; o fluxo ativo é `/books/new` (Argon — docs/feature/ARGON-UI-MIGRACAO.md).
 */
import Head from 'next/head';
import Link from 'next/link';
import { FiUpload } from 'react-icons/fi';
import { Alert, Button, Container } from 'reactstrap';
import EditorLayout from '../../components/EditorLayout';
import LoadingProgressOverlay from '../../components/LoadingProgressOverlay';
import { useNewBookWizard } from '../../hooks/useNewBookWizard';

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

      <Container className="py-4" style={{ maxWidth: 720 }}>
        <p className="small text-muted mb-2">
          <Link href="/books/new">Usar assistente Argon (recomendado)</Link>
          {' · '}
          <Link href="/books">Catálogo</Link>
        </p>
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Criar novo livro (legado)</h1>
          <p className="mt-1 text-sm text-gray-600">Assistente em passos — sem conhecimento técnico profundo.</p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {['Início', 'Metadados', 'Capítulos', 'Conteúdo'].map((label, i) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                w.step === i ? 'bg-blue-600 text-white' : w.step > i ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                {i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        {w.error ? <Alert color="danger">{w.error}</Alert> : null}

        {w.step === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-md">
            <h2 className="text-lg font-semibold text-gray-800">Bem-vindo</h2>
            <p className="mt-3 text-gray-600">
              Vai definir o título e a ficha do livro, organizar <strong>capítulos</strong> (secções simples) e, se
              quiser, importar um ficheiro PowerPoint. No fim, abrimos o <strong>editor visual</strong> para continuar a
              trabalhar as páginas.
            </p>
            <button type="button" className="mt-6 rounded bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700" onClick={() => w.setStep(1)}>
              Começar
            </button>
          </div>
        ) : null}

        {w.step >= 1 ? (
          <form onSubmit={w.handleSubmit} className="rounded-lg bg-white px-8 py-6 shadow-md">
            {w.step === 1 ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Metadados</h2>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="title">
                    Título *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={w.title}
                    onChange={(e) => w.setTitle(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="author">
                    Autor
                  </label>
                  <select
                    id="author"
                    value={w.authorId}
                    onChange={(e) => w.setAuthorId(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                  >
                    <option value="">Selecione um autor</option>
                    {w.loadingAuthors ? (
                      <option disabled>Carregando autores...</option>
                    ) : (
                      w.authors.map((author) => (
                        <option key={author.id} value={author.id}>
                          {author.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="category">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={w.categoryId}
                    onChange={(e) => w.setCategoryId(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                  >
                    <option value="">Selecione uma categoria</option>
                    {w.loadingCategories ? (
                      <option disabled>Carregando categorias...</option>
                    ) : (
                      w.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700" htmlFor="description">
                    Descrição
                  </label>
                  <textarea
                    id="description"
                    value={w.description}
                    onChange={(e) => w.setDescription(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-gray-700 shadow-sm"
                    rows={4}
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700">Capa</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex cursor-pointer items-center rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600">
                      <i className="ni ni-image mr-2" />
                      {w.uploadingCover ? 'A enviar…' : 'Enviar imagem'}
                      <input type="file" accept="image/*" className="hidden" onChange={w.handleCoverUpload} disabled={w.uploadingCover} />
                    </label>
                    {w.coverImage ? <span className="text-sm text-green-600">Capa selecionada</span> : null}
                  </div>
                  {w.coverImage ? (
                    <div className="mt-4 rounded border p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.coverImage} alt="" className="max-h-48 object-contain" />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {w.step === 2 ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-gray-800">Capítulos</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Cada capítulo gera uma primeira página vazia no livro — pode renomear e acrescentar mais páginas depois no
                  editor. Se importar PPTX no passo seguinte, as páginas do ficheiro passam à frente desta estrutura.
                </p>
                <div className="space-y-2">
                  {w.chapterTitles.map((ch, i) => (
                    <div key={`ch-row-${i}`} className="flex gap-2">
                      <input
                        type="text"
                        value={ch}
                        onChange={(e) => {
                          const next = [...w.chapterTitles];
                          next[i] = e.target.value;
                          w.setChapterTitles(next);
                        }}
                        className="flex-1 rounded border px-3 py-2 text-gray-800"
                        placeholder={`Capítulo ${i + 1}`}
                      />
                      {w.chapterTitles.length > 1 ? (
                        <button
                          type="button"
                          className="rounded border border-red-200 px-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => w.setChapterTitles(w.chapterTitles.filter((_, j) => j !== i))}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 rounded border border-blue-300 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  onClick={() => w.setChapterTitles([...w.chapterTitles, `Capítulo ${w.chapterTitles.length + 1}`])}
                >
                  + Adicionar capítulo
                </button>
              </>
            ) : null}

            {w.step === 3 ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-gray-800">Conteúdo inicial</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Opcional: importe um PowerPoint para criar várias páginas de uma vez. Se não importar, usamos os capítulos do
                  passo anterior (uma página por capítulo).
                </p>
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <label
                    className={`flex cursor-pointer items-center rounded px-4 py-2 font-bold text-white ${
                      w.importingPptx ? 'cursor-not-allowed bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    <FiUpload className="mr-2" />
                    {w.importingPptx ? 'A importar…' : 'Selecionar PPTX'}
                    <input
                      type="file"
                      accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      className="hidden"
                      onChange={w.handlePptxImport}
                      disabled={w.importingPptx}
                    />
                  </label>
                  {w.importedPages.length > 0 ? (
                    <span className="text-sm font-medium text-green-700">{w.importedPages.length} páginas importadas</span>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={w.goBackStep}
              >
                {w.step === 1 ? '← Início' : '← Anterior'}
              </button>
              {w.step < 3 ? (
                <button type="submit" className="rounded bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700">
                  Seguinte
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={w.loading}
                  className={`rounded bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-500 ${
                    w.loading ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {w.loading ? 'A criar…' : 'Criar livro e abrir editor'}
                </button>
              )}
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
