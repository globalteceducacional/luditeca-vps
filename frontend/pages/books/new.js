import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card, CardBody, Col, Row } from 'reactstrap';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import { BOOK_TYPES } from '../../lib/bookTypes';
import { useAuth } from '../../contexts/auth';
import { CMS_ROLES, isRole } from '../../lib/roles';
import { useEffect } from 'react';

export default function NewBookTypePickerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/app');
  }, [authLoading, user, router]);

  if (authLoading || !user) {
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
        <title>Novo livro — escolher tipo | Luditeca CMS</title>
      </Head>
      <ArgonCmsShell
        title="Novo livro"
        subtitle="Escolha o tipo editorial. Esta escolha é definitiva para o livro."
        breadcrumbs={[
          { label: 'Livros', href: '/books' },
          { label: 'Novo', href: '/books/new' },
        ]}
      >
        <Row>
          {BOOK_TYPES.map((t) => (
            <Col key={t.id} md="4" className="mb-4">
              <Card className="shadow border-0 h-100 luditeca-hover-lift">
                <CardBody className="d-flex flex-column">
                  <span className="display-4 mb-3" aria-hidden>
                    {t.icon}
                  </span>
                  <h3 className="h4 mb-2">{t.title}</h3>
                  <p className="text-muted flex-grow-1">{t.description}</p>
                  <Link
                    href={`/books/new/${t.id}`}
                    className="btn btn-primary luditeca-btn-gradient mt-2"
                  >
                    Criar {t.title.toLowerCase()}
                  </Link>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>

        <p className="small text-muted mt-2 mb-0">
          Outros fluxos:{' '}
          <Link href="/books/new-wizard">assistente (capítulos + PPTX → editor v2)</Link>
          {' · '}
          <Link href="/books/new-legacy">formulário legado Tailwind</Link>
        </p>
      </ArgonCmsShell>
    </Layout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
