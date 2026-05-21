import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Spinner } from 'reactstrap';
import ArgonAdmin from '../layouts/ArgonAdmin';
import { CmsThemeProvider } from '../contexts/cmsTheme';
import { useAuth } from '../contexts/auth';
import { ROLES } from '../lib/roles';

/** Shell CMS com sidebar Argon (Creative Tim, MIT). */
export default function Layout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (
      !loading &&
      user &&
      (user.role === ROLES.aluno || user.role === ROLES.professor)
    ) {
      router.replace('/app');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="luditeca-auth-loading">
        <div className="luditeca-auth-loading-brand">Luditeca</div>
        <Spinner color="primary" style={{ width: '2.75rem', height: '2.75rem' }} />
        <p className="text-muted small mt-3 mb-0">A preparar o painel…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <CmsThemeProvider>
      <ArgonAdmin>{children}</ArgonAdmin>
    </CmsThemeProvider>
  );
}
