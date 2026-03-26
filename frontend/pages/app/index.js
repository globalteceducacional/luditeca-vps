import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/auth';
import { ROLES } from '../../lib/roles';

export default function AppHome() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && ![ROLES.aluno, ROLES.professor].includes(user.role)) {
      router.replace('/books');
    }
  }, [loading, user, router]);

  if (loading) return null;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>App | UniverseTeca</title>
      </Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold mb-2">Área do App</h1>
          <p className="text-gray-700">
            Você está logado como <b>{user.role}</b>. Esta área é destinada a alunos e professores.
          </p>
          <p className="text-gray-500 mt-3 text-sm">
            Próximo passo: conectar aqui o app (leitura, progresso, favoritos, etc.).
          </p>
        </div>
      </div>
    </>
  );
}

