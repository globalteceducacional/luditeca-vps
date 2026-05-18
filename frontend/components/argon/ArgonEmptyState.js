import Link from 'next/link';
import classNames from 'classnames';
import { Button, Card, CardBody } from 'reactstrap';

/**
 * Estado vazio padronizado (Argon).
 * `variant="card"` — cartão completo (listagens).
 * `variant="inline"` — dentro de célula de tabela / espaço compacto.
 */
export default function ArgonEmptyState({
  variant = 'card',
  icon = 'ni ni-collection',
  iconShape = 'primary',
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimary,
  secondaryLabel,
  secondaryHref,
  onSecondary,
  className,
}) {
  const btnSm = variant === 'inline' ? 'btn-sm' : '';

  const primaryEl =
    primaryLabel && primaryHref ? (
      <Link
        href={primaryHref}
        className={classNames(
          'btn btn-primary luditeca-btn-gradient',
          btnSm,
          secondaryLabel ? 'mr-2 mb-2' : 'mb-2',
        )}
      >
        {primaryLabel}
      </Link>
    ) : primaryLabel && onPrimary ? (
      <Button
        color="primary"
        size={variant === 'inline' ? 'sm' : undefined}
        className={classNames('luditeca-btn-gradient', secondaryLabel ? 'mr-2 mb-2' : 'mb-2')}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
    ) : null;

  const secondaryEl =
    secondaryLabel && secondaryHref ? (
      <Link
        href={secondaryHref}
        className={classNames('btn btn-outline-secondary', btnSm, 'mb-2')}
      >
        {secondaryLabel}
      </Link>
    ) : secondaryLabel && onSecondary ? (
      <Button color="secondary" outline size={variant === 'inline' ? 'sm' : undefined} className="mb-2" onClick={onSecondary}>
        {secondaryLabel}
      </Button>
    ) : null;

  const inner = (
    <>
      <div className={variant === 'inline' ? 'mb-2' : 'mb-3'}>
        <span
          className={classNames(
            'icon-shape d-inline-flex',
            variant === 'inline' ? 'icon-sm' : 'icon-lg',
            `icon-shape-${iconShape}`,
          )}
        >
          <i className={icon} />
        </span>
      </div>
      <h4
        className={classNames(
          'text-dark font-weight-bold',
          variant === 'inline' ? 'h6 mb-1' : 'h4 mb-2',
        )}
      >
        {title}
      </h4>
      {description ? (
        <p
          className={classNames(
            'text-muted mx-auto luditeca-empty-state-desc',
            variant === 'inline' ? 'small mb-3' : 'mb-4',
          )}
        >
          {description}
        </p>
      ) : null}
      {(primaryEl || secondaryEl) ? (
        <div className="d-flex flex-wrap justify-content-center align-items-center">{primaryEl}{secondaryEl}</div>
      ) : null}
    </>
  );

  if (variant === 'inline') {
    return (
      <div className={classNames('luditeca-empty-state-inline text-center py-4 px-3', className)} role="status">
        {inner}
      </div>
    );
  }

  return (
    <Card className={classNames('shadow border-0 luditeca-empty-state-card', className)}>
      <CardBody className="py-5 px-4">
        <div className="text-center">{inner}</div>
      </CardBody>
    </Card>
  );
}
