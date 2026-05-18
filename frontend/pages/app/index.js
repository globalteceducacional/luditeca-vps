import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { FiBook, FiGrid, FiImage, FiLayers, FiMessageCircle } from 'react-icons/fi';
import { useAuth } from '../../contexts/auth';
import AppHubCard from '../../components/app/AppHubCard';
import AppShell from '../../components/app/AppShell';
import { APP_ROLES, isRole } from '../../lib/roles';

const SECTIONS = [
  {
    href: '/app/library',
    title: 'Biblioteca',
    description: 'Livros publicados para leitura',
    icon: FiBook,
    accent: 'success',
  },
  {
    href: '/app/activities',
    title: 'Atividades',
    description: 'Quiz, flashcards e mais',
    icon: FiGrid,
    accent: 'primary',
  },
  {
    href: '/app/libras',
    title: 'LIBRAS',
    description: 'Lições de sinais',
    icon: FiMessageCircle,
    accent: 'info',
  },
  {
    href: '/app/puzzle',
    title: 'Quebra-cabeça',
    description: 'Monte as imagens',
    icon: FiLayers,
    accent: 'warning',
  },
  {
    href: '/app/coloring',
    title: 'Pinturas',
    description: 'Páginas para colorir',
    icon: FiImage,
    accent: 'danger',
  },
];

export default function AppHome() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isRole(user, APP_ROLES)) router.replace('/books');
  }, [loading, user, router]);

  if (loading || !user) return null;

  const displayName = user.email?.split('@')[0] || user.role;

  return (
    <AppShell title="Mundo Lúdico" backHref="/books">
      <p className="luditeca-app-intro">
        Olá, <strong>{displayName}</strong>! Escolha uma área:
      </p>
      <ul className="luditeca-app-hub-grid">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <AppHubCard {...section} />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
