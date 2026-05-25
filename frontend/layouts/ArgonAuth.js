import { useEffect } from 'react';
import LuditecaLogo from '../components/auth/LuditecaLogo';
import AuthHeroIllustration from '../components/auth/AuthHeroIllustration';
import AuthThemeToggle from '../components/auth/AuthThemeToggle';

const AUTH_FEATURES = [
  'Editor de livros digitais, animados e interativos',
  'Biblioteca e atividades para alunos na app',
  'Gestão de autores, categorias e conteúdos',
];

export default function ArgonAuth({ children }) {
  useEffect(() => {
    document.body.classList.add('luditeca-auth-body');
    return () => document.body.classList.remove('luditeca-auth-body');
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="luditeca-auth-page">
      <aside className="luditeca-auth-page__hero">
        <div className="luditeca-auth-page__hero-inner">
          <LuditecaLogo variant="full" size="lg" tone="on-dark" className="luditeca-auth-page__hero-logo" />
          <p className="luditeca-auth-page__eyebrow">Plataforma educativa</p>
          <p className="luditeca-auth-page__brand-lead">
            Crie, publique e partilhe experiências de leitura com a sua equipa pedagógica.
          </p>
          <ul className="luditeca-auth-page__features">
            {AUTH_FEATURES.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
        <AuthHeroIllustration className="luditeca-auth-page__illustration" />
        <div className="luditeca-auth-page__hero-decor" aria-hidden />
      </aside>

      <main className="luditeca-auth-page__main">
        <div className="luditeca-auth-page__toolbar">
          <LuditecaLogo
            variant="full"
            size="sm"
            tone="auto"
            className="luditeca-auth-page__mobile-logo d-lg-none"
          />
          <AuthThemeToggle />
        </div>

        <div className="luditeca-auth-page__form-wrap">{children}</div>

        <p className="luditeca-auth-page__copyright">
          © {year} Luditeca. Todos os direitos reservados.
        </p>
      </main>
    </div>
  );
}
