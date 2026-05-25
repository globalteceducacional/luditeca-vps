import LuditecaLogo from './LuditecaLogo';

/**
 * Cartão de formulário nas páginas públicas de autenticação (login, recuperar senha, etc.).
 */
export default function LuditecaAuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="luditeca-auth-card">
      <header className="luditeca-auth-card__header">
        <LuditecaLogo variant="mark" size="md" tone="auto" className="luditeca-auth-card__logo" />
        <h1 className="luditeca-auth-card__title">{title}</h1>
        {subtitle ? <p className="luditeca-auth-card__subtitle">{subtitle}</p> : null}
      </header>
      <div className="luditeca-auth-card__body">{children}</div>
      {footer ? <footer className="luditeca-auth-card__footer">{footer}</footer> : null}
    </div>
  );
}
