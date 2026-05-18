import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Container } from 'reactstrap';
import LuditecaAdminNavbar from '../components/argon/LuditecaAdminNavbar';
import LuditecaSidebar from '../components/argon/LuditecaSidebar';
import {
  ADMIN_NAV,
  APP_PREVIEW_NAV,
  CMS_ACCOUNT_NAV,
  CMS_METADATA_NAV,
  CMS_NAV,
} from '../lib/argonRoutes';
import { CMS_ROLES, ROLES, isRole } from '../lib/roles';
import { useAuth } from '../contexts/auth';

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

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [router.pathname]);

  const routes = [...CMS_NAV];
  if (isRole(user, CMS_ROLES)) {
    routes.push(...CMS_METADATA_NAV);
    routes.push(...CMS_ACCOUNT_NAV);
  }
  if (user?.role === ROLES.admin) {
    routes.push(...ADMIN_NAV);
  }
  if (
    user?.role === ROLES.admin ||
    user?.role === ROLES.editor ||
    user?.role === ROLES.aluno ||
    user?.role === ROLES.professor
  ) {
    const isAppOnly = user?.role === ROLES.aluno || user?.role === ROLES.professor;
    if (!isAppOnly) routes.push(...APP_PREVIEW_NAV);
  }

  return (
    <>
      <LuditecaSidebar routes={routes} />
      <div className="main-content" ref={mainRef}>
        <LuditecaAdminNavbar brandText={titleFromPath(router.pathname)} />
        <div className="argon-page-transition" key={router.asPath}>
          {children}
        </div>
        <Container fluid>
          <footer className="footer pt-0 pb-4">
            <div className="text-center text-muted text-sm">
              Luditeca · UI baseada em{' '}
              <a
                href="https://www.creative-tim.com/product/argon-dashboard-react"
                target="_blank"
                rel="noreferrer"
                className="font-weight-bold"
              >
                Argon Dashboard
              </a>{' '}
              (MIT)
            </div>
          </footer>
        </Container>
      </div>
    </>
  );
}
