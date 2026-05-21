import { Card, CardBody, CardHeader } from 'reactstrap';

/** Cartão de formulário CMS — cabeçalho e corpo alinhados ao Argon Luditeca. */
export default function ArgonFormCard({ title, subtitle, headerExtra, children, className = '' }) {
  return (
    <Card className={`shadow border-0 luditeca-form-card ${className}`.trim()}>
      {title ? (
        <CardHeader className="border-0 luditeca-form-card-header">
          <div className="d-flex flex-wrap justify-content-between align-items-start">
            <div>
              <h4 className="mb-0 luditeca-card-title font-weight-bold">{title}</h4>
              {subtitle ? <p className="text-muted small mb-0 mt-2">{subtitle}</p> : null}
            </div>
            {headerExtra ? <div className="mt-2 mt-md-0">{headerExtra}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardBody className={title ? 'pt-0' : undefined}>{children}</CardBody>
    </Card>
  );
}
