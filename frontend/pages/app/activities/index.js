import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../../contexts/auth';
import AppShell from '../../../components/app/AppShell';
import AppStatusBlock from '../../../components/app/AppStatusBlock';
import { listAppActivities } from '../../../lib/appContent';
import { APP_ROLES, isRole } from '../../../lib/roles';

const TYPE_LABELS = {
  quiz: 'Quiz',
  flashcard: 'Flashcards',
  trueFalse: 'Verdadeiro ou falso',
  fillBlank: 'Complete a frase',
};

export default function AppActivitiesPage() {
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
    const { data, error: err } = await listAppActivities({ limit: 100 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES)) load();
  }, [user, load]);

  if (authLoading || !user) return null;

  return (
    <AppShell title="Atividades">
      <AppStatusBlock
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyMessage="Nenhuma atividade publicada."
      >
        <ul className="luditeca-app-stack">
          {rows.map((row) => (
            <li key={row.id} className="luditeca-app-stack-item">
              <Link href={`/app/activities/${row.id}`} className="luditeca-app-stack-link">
                <span className="luditeca-app-stack-badge">{TYPE_LABELS[row.type] || row.type}</span>
                <h2 className="luditeca-app-stack-title">{row.title}</h2>
                {row.description ? <p className="luditeca-app-stack-desc">{row.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </AppStatusBlock>
    </AppShell>
  );
}
