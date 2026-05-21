import classNames from 'classnames';
import { Col, Row } from 'reactstrap';
import LuditecaButton from './LuditecaButton';

/** Cabeçalho de página CMS — alinhado ao padrão Argon Dashboard React (título + traço gradiente + CTA). */
export default function ArgonPageHeader({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  actionDisabled,
  titleTag: TitleTag = 'h2',
  children,
}) {
  return (
    <header className="luditeca-page-header mb-4">
      <Row className="align-items-center">
        <Col>
          <TitleTag className={classNames('luditeca-page-header-title mb-0', TitleTag === 'h2' ? 'h3' : null)}>
            {title}
          </TitleTag>
          <span className="luditeca-page-header-accent" aria-hidden="true" />
          {subtitle ? <p className="text-muted mb-0 mt-3 small">{subtitle}</p> : null}
        </Col>
        {(actionLabel && onAction) || children ? (
          <Col xs="auto" className="text-right pt-2 pt-md-0">
            {actionLabel && onAction ? (
              <LuditecaButton
                variant="primary"
                size="sm"
                icon={actionIcon}
                onClick={onAction}
                disabled={actionDisabled}
              >
                {actionLabel}
              </LuditecaButton>
            ) : null}
            {children}
          </Col>
        ) : null}
      </Row>
    </header>
  );
}
