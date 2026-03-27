import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/auth';
import { devLog } from '../lib/devLog';
import { ROLES } from '../lib/roles';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  
  devLog('PÃ¡gina inicial renderizada:', { user: !!user, loading, redirecting });
  
  useEffect(() => {
    // Prevenir mÃºltiplos redirecionamentos
    if (redirecting) return;
    
    devLog('useEffect da pÃ¡gina inicial:', { user: !!user, loading });
    
    // Apenas redirecionar quando o loading terminar
    if (!loading) {
      setRedirecting(true);
      
      if (user) {
        if (user.role === ROLES.aluno || user.role === ROLES.professor) {
          devLog('UsuÃ¡rio app-only, redirecionando para /app');
          router.push('/app');
        } else {
          devLog('UsuÃ¡rio CMS, redirecionando para /books');
          router.push('/books');
        }
      } else {
        devLog('UsuÃ¡rio nÃ£o autenticado, redirecionando para /login');
        router.push('/login');
      }
    }
  }, [user, loading, router, redirecting]);
  
  // SeguranÃ§a: se o loading estiver preso por muito tempo, forÃ§ar redirecionamento
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && !redirecting) {
        devLog('Timer de seguranÃ§a acionado - redirecionando para /login apÃ³s timeout');
        setRedirecting(true);
        router.push('/login');
      }
    }, 8000); // 8 segundos de timeout
    
    return () => clearTimeout(timer);
  }, [loading, redirecting, router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600 mb-4">Luditeca CMS</div>
        {loading ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-lg text-gray-600">Verificando autenticaÃ§Ã£o...</div>
          </div>
        ) : (
          <div className="text-lg text-gray-600">Redirecionando...</div>
        )}
      </div>
    </div>
  );
} 
