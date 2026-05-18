import { Card, CardBody, CardHeader } from 'reactstrap';

/** Cartão de formulário CMS — cabeçalho e corpo alinhados ao Argon Luditeca. */
export default function ArgonFormCard({ title, subtitle, children, className = '' }) {
  return (
    <Card className={`shadow border-0 luditeca-form-card ${className}`.trim()}>
      {title ? (
        <CardHeader className="border-0 luditeca-form-card-header">
          <h4 className="mb-0 text-dark font-weight-bold">{title}</h4>
          {subtitle ? <p className="text-muted small mb-0 mt-2">{subtitle}</p> : null}
        </CardHeader>
      ) : null}
      <CardBody className={title ? 'pt-0' : undefined}>{children}</CardBody>
    </Card>
  );
}
