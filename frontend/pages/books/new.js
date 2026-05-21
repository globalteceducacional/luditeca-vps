import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Badge, Card, CardBody, Col, Row } from 'reactstrap';
import LuditecaAlert from '../../components/argon/LuditecaAlert';
import { LuditecaButton } from '../../components/argon/luditeca';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import { BOOK_CREATION_PATHS, BOOK_TYPES } from '../../lib/bookTypes';
import { useAuth } from '../../contexts/auth';
import { CMS_ROLES, isRole } from '../../lib/roles';

export default function NewBookTypePickerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [path, setPath] = useState(null);

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

  const showTypePicker = path === BOOK_CREATION_PATHS.appTypes.id;

  return (
    <Layout>
      <Head>
        <title>Novo livro | Luditeca CMS</title>
      </Head>
      <ArgonCmsShell
        title="Novo livro"
        contentConstrained
        subtitle={
          showTypePicker
            ? 'Escolha o formato na app infantil. Esta escolha não pode ser alterada depois.'
            : 'Como queres criar este livro?'
        }
        breadcrumbs={[
          { label: 'Painel', href: '/books' },
          { label: 'Livros', href: '/books' },
          { label: 'Novo livro' },
        ]}
      >
        {!showTypePicker ? (
          <>
            <Row className="justify-content-center mb-4">
              <Col md="6" lg="5" className="mb-4">
                <Card
                  className={`shadow border-0 h-100 luditeca-hover-lift ${BOOK_CREATION_PATHS.appTypes.recommended ? 'border border-primary' : ''}`}
                >
                  <CardBody className="d-flex flex-column">
                    {BOOK_CREATION_PATHS.appTypes.recommended ? (
                      <Badge color="primary" pill className="align-self-start mb-2">
                        Recomendado
                      </Badge>
                    ) : null}
                    <h3 className="h4 mb-2">{BOOK_CREATION_PATHS.appTypes.title}</h3>
                    <p className="text-muted flex-grow-1">{BOOK_CREATION_PATHS.appTypes.description}</p>
                    <LuditecaButton
                      variant="primary"
                      className="mt-2"
                      type="button"
                      onClick={() => setPath(BOOK_CREATION_PATHS.appTypes.id)}
                    >
                      Continuar →
                    </LuditecaButton>
                  </CardBody>
                </Card>
              </Col>
              <Col md="6" lg="5" className="mb-4">
                <Card className="shadow border-0 h-100 luditeca-hover-lift">
                  <CardBody className="d-flex flex-column">
                    <Badge color="info" pill className="align-self-start mb-2">
                      {BOOK_CREATION_PATHS.wizard.badge}
                    </Badge>
                    <h3 className="h4 mb-2">{BOOK_CREATION_PATHS.wizard.title}</h3>
                    <p className="text-muted flex-grow-1">{BOOK_CREATION_PATHS.wizard.description}</p>
                    <LuditecaButton
                      variant="outline"
                      outlineColor="info"
                      tag={Link}
                      href={BOOK_CREATION_PATHS.wizard.href}
                      className="mt-2"
                    >
                      Abrir assistente
                    </LuditecaButton>
                  </CardBody>
                </Card>
              </Col>
            </Row>
            <LuditecaAlert color="light" className="border">
              <strong>Tens um PowerPoint?</strong> Usa o assistente com importação PPTX — não escolhas
              «livro animado» só para carregar slides.
            </LuditecaAlert>
          </>
        ) : (
          <>
            <LuditecaButton variant="link" className="p-0 mb-3" type="button" onClick={() => setPath(null)}>
              ← Voltar à escolha do fluxo
            </LuditecaButton>
            <Row>
              {BOOK_TYPES.map((t) => (
                <Col key={t.id} md="4" className="mb-4">
                  <Card className="shadow border-0 h-100 luditeca-hover-lift">
                    <CardBody className="d-flex flex-column">
                      <span className="display-4 mb-3" aria-hidden>
                        {t.icon}
                      </span>
                      <h3 className="h4 mb-2">{t.title}</h3>
                      <p className="text-muted mb-2">{t.description}</p>
                      {t.whenToUse ? (
                        <p className="small text-primary mb-3">
                          <strong>Usa quando:</strong> {t.whenToUse}
                        </p>
                      ) : null}
                      <LuditecaButton
                        variant="primary"
                        tag={Link}
                        href={`/books/new/${t.id}`}
                        className="mt-auto"
                      >
                        Criar {t.title.toLowerCase()}
                      </LuditecaButton>
                    </CardBody>
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}

        <p className="small text-muted mt-2 mb-0">
          {showTypePicker ? (
            <>
              Outro fluxo:{' '}
              <Link href={BOOK_CREATION_PATHS.wizard.href}>assistente capítulos + PPTX</Link>
            </>
          ) : null}
          {' · '}
          <Link href="/books/new-legacy">formulário legado</Link>
        </p>
      </ArgonCmsShell>
    </Layout>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
