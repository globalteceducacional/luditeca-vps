import { Card, CardBody, CardHeader, Container, Spinner } from 'reactstrap';
import { CMS_SHELL_CLASS } from '../../lib/cmsUiClasses';
import ArgonPageHeader from './ArgonPageHeader';

/** Layout padrão de página CMS: Container + header + cartões (estilo Argon admin). */
export default function ArgonCmsShell({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  actionDisabled,
  headerExtra,
  loading,
  loadingLabel = 'A carregar…',
  children,
}) {
  return (
    <div className={`${CMS_SHELL_CLASS} animate__animated animate__fadeIn`} style={{ animationDuration: '0.38s' }}>
      <Container fluid>
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
          <Card className="shadow border-0">
            <CardBody className="text-center py-5">
              <Spinner color="primary" />
              <p className="text-muted mt-3 mb-0">{loadingLabel}</p>
            </CardBody>
          </Card>
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
          {title ? <h3 className="mb-0 h4 font-weight-bold text-dark">{title}</h3> : <span />}
          {toolbar || null}
        </CardHeader>
      ) : null}
      <CardBody className={title || toolbar ? 'pt-0' : undefined}>{children}</CardBody>
    </Card>
  );
}
