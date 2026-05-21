import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Badge, Form } from 'reactstrap';
import { LuditecaButton } from '../../argon/luditeca';
import Layout from '../../Layout';
import LuditecaAlert from '../../argon/LuditecaAlert';
import ArgonCmsShell from '../../argon/ArgonCmsShell';
import ArgonFormCard from '../../argon/ArgonFormCard';
import LoadingProgressOverlay from '../../LoadingProgressOverlay';
import BookCreateMetadata from './BookCreateMetadata';
import AnimatedBookEditor from './AnimatedBookEditor';
import InteractiveBookEditor from './InteractiveBookEditor';
import DigitalBookEditor from './DigitalBookEditor';
import BookTypeFlowSteps from './BookTypeFlowSteps';
import BookPublishPanel, { PublishConfirmModal } from './BookPublishPanel';
import BookAppPreviewModal from './BookAppPreviewModal';
import { getBookPublishChecklist } from '../../../lib/bookPublishChecklist';
import { getBookTypeMeta } from '../../../lib/bookTypes';
import { useBookTypeFlow } from '../../../hooks/useBookTypeFlow';
import { toast } from 'react-hot-toast';

export default function BookTypeFlowPage({ bookType, bookId = null }) {
  const meta = getBookTypeMeta(bookType);
  const router = useRouter();
  const flow = useBookTypeFlow({ bookType, bookId });
  const [appPreviewOpen, setAppPreviewOpen] = useState(false);

  if (flow.authLoading || !flow.user) {
    return (
      <Layout>
        <Head>
          <title>{meta?.title || 'Livro'} | Luditeca CMS</title>
        </Head>
        <ArgonCmsShell title={meta?.title || 'Livro'} loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  if (!meta) {
    return (
      <Layout>
        <ArgonCmsShell title="Tipo inválido">
          <LuditecaAlert color="warning">Tipo de livro não reconhecido.</LuditecaAlert>
          <Link href="/books/new">← Voltar</Link>
        </ArgonCmsShell>
      </Layout>
    );
  }

  const onCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await flow.uploadMedia(file, 'covers');
      flow.patchForm({ cover_image: url });
      toast.success('Capa enviada.');
    } catch (err) {
      toast.error(err?.message || 'Falha no upload da capa.');
    }
  };

  const onUpload = (file, bucket, prefix, progressOpts) =>
    flow.uploadMedia(file, bucket, prefix, progressOpts);

  const loading = flow.loadingMeta || flow.loadingBook;
  const step = flow.step;

  const overlayActive = flow.saving || (flow.uploading && !flow.uploadProgress);
  const overlayMessage = flow.saving
    ? 'A guardar no servidor…'
    : flow.uploadProgress?.label || 'A enviar ficheiros…';

  return (
    <Layout>
      <Head>
        <title>
          {flow.isEdit ? 'Editar' : 'Novo'} — {meta.title} | Luditeca CMS
        </title>
      </Head>
      <LoadingProgressOverlay
        active={overlayActive}
        title={flow.saving ? 'A guardar' : 'A enviar'}
        message={overlayMessage}
        mode={flow.uploadProgress?.total ? 'determinate' : 'indeterminate'}
        percent={
          flow.uploadProgress?.total
            ? Math.round((flow.uploadProgress.current / flow.uploadProgress.total) * 100)
            : 0
        }
        compact={Boolean(flow.uploadProgress)}
      />

      <PublishConfirmModal
        open={flow.publishModalOpen}
        toggle={() => flow.setPublishModalOpen(false)}
        onConfirm={flow.handlePublishConfirm}
        saving={flow.saving}
        bookTitle={flow.form.title}
        bookType={bookType}
        form={flow.form}
      />

      <BookAppPreviewModal
        open={appPreviewOpen}
        toggle={() => setAppPreviewOpen(false)}
        bookType={bookType}
        form={flow.form}
      />

      <ArgonCmsShell
        breadcrumbContext={{ bookTitle: flow.form.title || undefined }}
        contentConstrained
        title={flow.isEdit ? `Editar: ${flow.form.title || meta.title}` : meta.title}
        subtitle={
          <>
            <Badge color="primary" className="mr-2">
              {bookType}
            </Badge>
            {!flow.isEdit ? (
              <>
                {' '}
                <Link href="/books/new">Trocar tipo</Link>
              </>
            ) : null}
          </>
        }
        breadcrumbs={[
          { label: 'Livros', href: '/books' },
          {
            label: flow.isEdit ? 'Editar' : 'Novo',
            href: flow.isEdit ? `/books/${bookId}/edit-flow` : `/books/new/${bookType}`,
          },
        ]}
        loading={loading}
        loadingLabel="A carregar formulário…"
      >
        <BookTypeFlowSteps currentStep={step} />

        {flow.lastSavedAt ? (
          <p className="small text-muted text-right mb-2">
            Guardado automaticamente às{' '}
            {flow.lastSavedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </p>
        ) : null}

        {flow.error ? <LuditecaAlert color="danger">{flow.error}</LuditecaAlert> : null}

        {flow.isEdit && flow.isPublished ? (
          <LuditecaAlert color="success" className="mb-3">
            Este livro está <strong>publicado</strong> na app infantil.
            {flow.activeBookId ? (
              <>
                {' '}
                <Link
                  href={`/app/library/${flow.activeBookId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pré-visualizar na app
                </Link>
              </>
            ) : null}
          </LuditecaAlert>
        ) : null}

        {flow.activeBookId && !flow.isPublished ? (
          <LuditecaAlert color="light" className="border mb-3">
            Rascunho guardado no servidor.
            {flow.activeBookId ? (
              <>
                {' '}
                <Link
                  href={`/app/library/${flow.activeBookId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver na app (ainda não publicado)
                </Link>
              </>
            ) : null}
          </LuditecaAlert>
        ) : null}

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) void flow.goNextStep();
            else flow.handleSaveDraft(e);
          }}
        >
          {step === 0 ? (
            <ArgonFormCard title="1. Ficha do livro" className="mb-4">
              <BookCreateMetadata
                form={flow.form}
                onChange={flow.patchForm}
                authors={flow.authors}
                categories={flow.categories}
                onAuthorCreated={flow.onAuthorCreated}
                onCategoryCreated={flow.onCategoryCreated}
                loadingAuthors={flow.loadingAuthors}
                loadingCategories={flow.loadingCategories}
                onCoverUpload={onCoverUpload}
                uploadingCover={flow.uploading}
                showWorkflow={false}
              />
            </ArgonFormCard>
          ) : null}

          {step === 1 ? (
            <ArgonFormCard
              title="2. Conteúdo"
              className="mb-4"
              headerExtra={
                <LuditecaButton
                  variant="outline"
                  outlineColor="info"
                  size="sm"
                  type="button"
                  onClick={() => setAppPreviewOpen(true)}
                >
                  Pré-visualizar app
                </LuditecaButton>
              }
            >
              {bookType === 'animated' ? (
                <AnimatedBookEditor
                  form={flow.form}
                  onChange={flow.patchForm}
                  onUpload={onUpload}
                  uploading={flow.uploading}
                  uploadProgress={flow.uploadProgress}
                />
              ) : null}
              {bookType === 'interactive' ? (
                <InteractiveBookEditor
                  form={flow.form}
                  onChange={flow.patchForm}
                  onUpload={onUpload}
                  uploading={flow.uploading}
                />
              ) : null}
              {bookType === 'digital' ? (
                <DigitalBookEditor
                  form={flow.form}
                  onChange={flow.patchForm}
                  onUpload={onUpload}
                  uploading={flow.uploading}
                />
              ) : null}
            </ArgonFormCard>
          ) : null}

          {step === 2 ? (
            <ArgonFormCard title="3. Publicação" className="mb-4">
              <BookPublishPanel
                form={flow.form}
                onChange={flow.patchForm}
                bookType={bookType}
                onPreviewClick={() => setAppPreviewOpen(true)}
                onGoToStep={(n) => {
                  flow.setStep(n);
                  flow.setError(null);
                  if (flow.activeBookId) {
                    router.replace(
                      {
                        pathname: `/books/${flow.activeBookId}/edit-flow`,
                        query: { step: String(n) },
                      },
                      undefined,
                      { shallow: true },
                    );
                  }
                }}
                onPublishClick={() => {
                  const { ready } = getBookPublishChecklist(bookType, flow.form);
                  if (!ready) {
                    toast.error('Complete o checklist antes de publicar.');
                    return;
                  }
                  flow.setPublishModalOpen(true);
                }}
                publishing={flow.saving}
                isPublished={flow.isPublished}
              />
            </ArgonFormCard>
          ) : null}

          <div className="d-flex flex-wrap justify-content-between align-items-center">
            <div>
              <LuditecaButton variant="outline" tag={Link} href="/books" type="button">
                Cancelar
              </LuditecaButton>
              {step > 0 ? (
                <LuditecaButton
                  variant="link"
                  type="button"
                  className="ml-2"
                  onClick={flow.goPrevStep}
                  disabled={flow.saving || flow.uploading}
                >
                  ← Anterior
                </LuditecaButton>
              ) : null}
            </div>
            <div className="d-flex flex-wrap">
              {step === 2 ? (
                <LuditecaButton
                  variant="outline"
                  type="button"
                  className="mr-2"
                  disabled={flow.saving || flow.uploading}
                  loading={flow.saving}
                  loadingLabel="A guardar…"
                  onClick={() => flow.handleSaveDraft()}
                >
                  Guardar rascunho
                </LuditecaButton>
              ) : null}
              {step < 2 ? (
                <LuditecaButton variant="primary" type="submit" disabled={flow.uploading}>
                  Seguinte →
                </LuditecaButton>
              ) : (
                <LuditecaButton
                  variant="primary"
                  type="submit"
                  disabled={flow.saving || flow.uploading}
                  loading={flow.saving}
                  loadingLabel="A guardar…"
                >
                  {flow.isEdit ? 'Guardar alterações' : 'Criar rascunho'}
                </LuditecaButton>
              )}
            </div>
          </div>
        </Form>

        <p className="small text-muted mt-4 mb-0">
          Livro com canvas ou PowerPoint?{' '}
          <Link href="/books/new-wizard">Usar o assistente capítulos/PPTX</Link>
          {flow.isEdit && bookId && !bookType ? null : null}
        </p>
      </ArgonCmsShell>
    </Layout>
  );
}
