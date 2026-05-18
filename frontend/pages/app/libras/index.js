import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '../../../contexts/auth';
import AppShell from '../../../components/app/AppShell';
import AppStatusBlock from '../../../components/app/AppStatusBlock';
import { listAppLibrasLessons } from '../../../lib/appContent';
import { APP_ROLES, isRole } from '../../../lib/roles';

export default function AppLibrasPage() {
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
    const { data, error: err } = await listAppLibrasLessons({ limit: 200 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES)) load();
  }, [user, load]);

  if (authLoading || !user) return null;

  return (
    <AppShell title="LIBRAS">
      <AppStatusBlock loading={loading} error={error} empty={!loading && !error && rows.length === 0} emptyMessage="Nenhuma lição disponível.">
        <ul className="luditeca-app-list-grid">
          {rows.map((row) => (
            <li key={row.id} className="luditeca-app-media-card">
              {row.image_url ? (
                <div className="luditeca-app-media-card-image luditeca-app-media-card-image--video">
                  <Image src={row.image_url} alt={row.word} fill className="object-contain p-2" unoptimized />
                </div>
              ) : null}
              <div className="luditeca-app-media-card-body">
                <h2 className="luditeca-app-media-card-title">{row.word}</h2>
                {row.category ? <p className="luditeca-app-media-card-meta">{row.category}</p> : null}
                {row.description ? <p className="luditeca-app-media-card-text">{row.description}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </AppStatusBlock>
    </AppShell>
  );
}
