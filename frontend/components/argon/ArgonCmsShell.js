import { useRouter } from 'next/router';
import { Card, CardBody, CardHeader, Container, Spinner, Table } from 'reactstrap';
import { CMS_SHELL_CLASS } from '../../lib/cmsUiClasses';
import { buildCmsBreadcrumbs } from '../../lib/cmsBreadcrumbs';
import ArgonBreadcrumbs from './ArgonBreadcrumbs';
import ArgonPageHeader from './ArgonPageHeader';
import { BookCatalogGridSkeleton, TableRowsSkeleton } from './LuditecaSkeleton';

/** Layout padrão de página CMS: Container + header + cartões (estilo Argon admin). */
export default function ArgonCmsShell({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  actionDisabled,
  headerExtra,
  breadcrumbs,
  breadcrumbContext,
  contentConstrained,
  loading,
  loadingLabel = 'A carregar…',
  /** 'spinner' | 'books' | 'table' — skeleton em vez de spinner (Fase 4) */
  loadingVariant = 'spinner',
  children,
}) {
  const router = useRouter();
  const crumbItems =
    breadcrumbs !== undefined
      ? breadcrumbs
      : buildCmsBreadcrumbs(router.pathname, breadcrumbContext);

  return (
    <div className={CMS_SHELL_CLASS}>
      <Container fluid className={contentConstrained ? 'luditeca-content-constrained' : undefined}>
        {crumbItems?.length ? <ArgonBreadcrumbs items={crumbItems} /> : null}
        <ArgonPageHeader
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          actionIcon={actionIcon}
          onAction={onAction}
          actionDisabled={actionDisabled}
        >
          {headerExtra}
        </ArgonPageHeader>
        {loading ? (
          loadingVariant === 'books' ? (
            <BookCatalogGridSkeleton count={8} />
          ) : loadingVariant === 'table' ? (
            <ArgonTableCard title={loadingLabel}>
              <div className="table-responsive">
                <Table className="align-items-center table-flush">
                  <thead className="thead-light">
                    <tr>
                      <th scope="col">
                        <span className="sr-only">A carregar</span>
                      </th>
                      <th scope="col" />
                      <th scope="col" />
                    </tr>
                  </thead>
                  <TableRowsSkeleton rows={6} cols={3} />
                </Table>
              </div>
            </ArgonTableCard>
          ) : (
            <Card className="shadow border-0">
              <CardBody className="text-center py-5">
                <Spinner color="primary" />
                <p className="text-muted mt-3 mb-0">{loadingLabel}</p>
              </CardBody>
            </Card>
          )
        ) : (
          children
        )}
      </Container>
    </div>
  );
}

export function ArgonTableCard({ title, toolbar, children }) {
  return (
    <Card className="shadow border-0">
      {title || toolbar ? (
        <CardHeader className="border-0 d-flex flex-wrap align-items-center justify-content-between">
          {title ? <h3 className="mb-0 h4 font-weight-bold luditeca-card-title">{title}</h3> : <span />}
          {toolbar || null}
        </CardHeader>
      ) : null}
      <CardBody className={title || toolbar ? 'pt-0' : undefined}>{children}</CardBody>
    </Card>
  );
}
