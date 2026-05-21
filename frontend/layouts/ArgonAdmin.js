import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Container } from 'reactstrap';
import LuditecaAdminNavbar from '../components/argon/LuditecaAdminNavbar';
import LuditecaSidebar from '../components/argon/LuditecaSidebar';
import { buildCmsSidebarGroups } from '../lib/argonRoutes';
import { CMS_ROLES, ROLES, isRole } from '../lib/roles';
import { useAuth } from '../contexts/auth';
import { useCmsTheme } from '../contexts/cmsTheme';

function titleFromPath(pathname) {
  if (pathname.startsWith('/books')) return 'Livros';
  if (pathname.startsWith('/admin/users')) return 'Utilizadores';
  if (pathname.startsWith('/admin/audit')) return 'Trilha de ações';
  if (pathname.startsWith('/admin/telemetry')) return 'Telemetria';
  if (pathname.startsWith('/admin/activities')) return 'Atividades';
  if (pathname.startsWith('/admin/libras')) return 'LIBRAS';
  if (pathname.startsWith('/admin/puzzle')) return 'Quebra-cabeça';
  if (pathname.startsWith('/admin/coloring')) return 'Pinturas';
  if (pathname === '/admin') return 'Área Admin';
  if (pathname.startsWith('/admin')) return 'Área Admin';
  if (pathname.startsWith('/authors')) return 'Autores';
  if (pathname.startsWith('/categories')) return 'Categorias';
  if (pathname.startsWith('/profile')) return 'Perfil';
  return 'Luditeca';
}

export default function ArgonAdmin({ children }) {
  const mainRef = useRef(null);
  const router = useRouter();
  const { user } = useAuth();
  const { resolved: cmsTheme } = useCmsTheme();

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [router.pathname]);

  let sidebarGroups = buildCmsSidebarGroups(user);
  if (!isRole(user, CMS_ROLES)) {
    sidebarGroups = sidebarGroups.filter((g) => g.id === 'preview');
  } else {
    const isAppOnly = user?.role === ROLES.aluno || user?.role === ROLES.professor;
    if (isAppOnly) {
      sidebarGroups = sidebarGroups.filter((g) => g.id === 'preview');
    }
  }

  return (
    <div className="luditeca-cms-chrome" data-luditeca-theme={cmsTheme}>
      <LuditecaSidebar groups={sidebarGroups} />
      <div className="main-content" ref={mainRef}>
        <LuditecaAdminNavbar brandText={titleFromPath(router.pathname)} />
        <div className="argon-page-transition" key={router.asPath}>
          {children}
        </div>
        <Container fluid>
          <footer className="footer pt-0 pb-4 luditeca-footer-minimal">
            <div className="text-center">© {new Date().getFullYear()} Luditeca</div>
          </footer>
        </Container>
      </div>
    </div>
  );
}
