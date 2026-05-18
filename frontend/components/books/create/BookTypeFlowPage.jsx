import Head from 'next/head';
import Link from 'next/link';
import { Alert, Badge, Button, Form, Spinner } from 'reactstrap';
import Layout from '../../Layout';
import ArgonCmsShell from '../../argon/ArgonCmsShell';
import ArgonFormCard from '../../argon/ArgonFormCard';
import BookCreateMetadata from './BookCreateMetadata';
import AnimatedBookEditor from './AnimatedBookEditor';
import InteractiveBookEditor from './InteractiveBookEditor';
import DigitalBookEditor from './DigitalBookEditor';
import { getBookTypeMeta } from '../../../lib/bookTypes';
import { useBookTypeFlow } from '../../../hooks/useBookTypeFlow';
import { toast } from 'react-hot-toast';

export default function BookTypeFlowPage({ bookType, bookId = null }) {
  const meta = getBookTypeMeta(bookType);
  const flow = useBookTypeFlow({ bookType, bookId });

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
          <Alert color="warning">Tipo de livro não reconhecido.</Alert>
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

  const onUpload = (file, bucket, prefix) => flow.uploadMedia(file, bucket, prefix);

  const loading = flow.loadingMeta || flow.loadingBook;

  return (
    <Layout>
      <Head>
        <title>
          {flow.isEdit ? 'Editar' : 'Novo'} — {meta.title} | Luditeca CMS
        </title>
      </Head>
      <ArgonCmsShell
        title={flow.isEdit ? `Editar: ${flow.form.title || meta.title}` : meta.title}
        subtitle={
          <>
            <Badge color="primary" className="mr-2">
              {bookType}
            </Badge>
            O tipo não pode ser alterado após a criação.
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
          { label: flow.isEdit ? 'Editar' : 'Novo', href: flow.isEdit ? `/books/${bookId}/edit-flow` : `/books/new/${bookType}` },
        ]}
        loading={loading}
        loadingLabel="A carregar formulário…"
      >
        {flow.error ? <Alert color="danger">{flow.error}</Alert> : null}

        <Form onSubmit={flow.handleSubmit}>
          <ArgonFormCard title="Metadados" className="mb-4">
            <BookCreateMetadata
              form={flow.form}
              onChange={flow.patchForm}
              authors={flow.authors}
              categories={flow.categories}
              onCoverUpload={onCoverUpload}
              uploadingCover={flow.uploading}
            />
          </ArgonFormCard>

          <ArgonFormCard title="Conteúdo" className="mb-4">
            {bookType === 'animated' ? (
              <AnimatedBookEditor
                form={flow.form}
                onChange={flow.patchForm}
                onUpload={onUpload}
                uploading={flow.uploading}
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

          <div className="d-flex flex-wrap justify-content-between align-items-center">
            <Button tag={Link} href="/books" color="secondary" outline>
              Cancelar
            </Button>
            <Button color="success" type="submit" disabled={flow.saving || flow.uploading}>
              {flow.saving ? (
                <>
                  <Spinner size="sm" className="mr-2" /> A guardar…
                </>
              ) : flow.isEdit ? (
                'Guardar alterações'
              ) : (
                'Criar livro'
              )}
            </Button>
          </div>
        </Form>

        <p className="small text-muted mt-4 mb-0">
          Fluxos alternativos:{' '}
          <Link href="/books/new-wizard">assistente capítulos/PPTX</Link>
          {' · '}
          <Link href="/books/new-legacy">editor legado</Link>
          {flow.isEdit && bookId ? (
            <>
              {' · '}
              <Link href={`/books/${bookId}/edit-v2`}>editor visual v2</Link>
            </>
          ) : null}
        </p>
      </ArgonCmsShell>
    </Layout>
  );
}
