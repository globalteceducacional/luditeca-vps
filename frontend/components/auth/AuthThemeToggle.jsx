import { FiMoon, FiSun } from 'react-icons/fi';
import { useCmsTheme } from '../../contexts/cmsTheme';

/** Alternância rápida claro/escuro (sincroniza com o CMS). */
export default function AuthThemeToggle() {
  const { resolved, toggleResolved } = useCmsTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      className="luditeca-auth-theme-toggle"
      onClick={toggleResolved}
      aria-label={isDark ? 'Activar tema claro' : 'Activar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? <FiSun size={20} aria-hidden /> : <FiMoon size={20} aria-hidden />}
    </button>
  );
}
