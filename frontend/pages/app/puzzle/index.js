import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '../../../contexts/auth';
import AppShell from '../../../components/app/AppShell';
import AppStatusBlock from '../../../components/app/AppStatusBlock';
import { listAppPuzzleGames } from '../../../lib/appContent';
import { APP_ROLES, isRole } from '../../../lib/roles';

export default function AppPuzzlePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, APP_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await listAppPuzzleGames({ limit: 100 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES)) load();
  }, [user, load]);

  if (authLoading || !user) return null;

  return (
    <AppShell title="Quebra-cabeça">
      <AppStatusBlock
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyMessage="Nenhum puzzle publicado."
      >
        <ul className="luditeca-app-list-grid">
          {rows.map((row) => (
            <li key={row.id} className="luditeca-app-media-card">
              {row.image_url ? (
                <div className="luditeca-app-media-card-image luditeca-app-media-card-image--square">
                  <Image src={row.image_url} alt={row.title} fill className="object-cover" unoptimized />
                </div>
              ) : null}
              <div className="luditeca-app-media-card-body">
                <h2 className="luditeca-app-media-card-title">{row.title}</h2>
                <p className="luditeca-app-media-card-meta">{row.piece_count} peças</p>
                {row.description ? <p className="luditeca-app-media-card-text">{row.description}</p> : null}
                <p className="luditeca-app-media-card-text text-muted mb-0">Jogo interativo em breve.</p>
              </div>
            </li>
          ))}
        </ul>
      </AppStatusBlock>
    </AppShell>
  );
}
