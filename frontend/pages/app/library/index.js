import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { FiBook } from 'react-icons/fi';
import { useAuth } from '../../../contexts/auth';
import AppShell from '../../../components/app/AppShell';
import AppStatusBlock from '../../../components/app/AppStatusBlock';
import { listAppBooks } from '../../../lib/appContent';
import { getFileUrl } from '../../../lib/mediaUrl';
import { getBookTypeLabel } from '../../../lib/bookTypes';
import { APP_ROLES, isRole } from '../../../lib/roles';

function coverUrl(book) {
  const raw = book.cover_image || book.coverImage;
  if (!raw) return null;
  if (String(raw).startsWith('http')) return raw;
  return getFileUrl('covers', raw);
}

export default function AppLibraryPage() {
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
    const { data, error: err } = await listAppBooks({ limit: 100 });
    if (err) setError(err.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES)) load();
  }, [user, load]);

  if (authLoading || !user) return null;

  return (
    <AppShell title="Biblioteca">
      <AppStatusBlock
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyMessage="Nenhum livro publicado ainda."
      >
        <ul className="luditeca-app-list-grid">
          {rows.map((book) => {
            const id = String(book.id);
            const url = coverUrl(book);
            return (
              <li key={id}>
                <Link href={`/app/library/${id}`} className="luditeca-app-list-card">
                  <div className="luditeca-app-list-card-thumb">
                    {url ? (
                      <Image src={url} alt="" width={80} height={112} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <FiBook className="text-muted" size={32} />
                    )}
                  </div>
                  <div className="min-w-0 flex-grow-1">
                    <h2 className="luditeca-app-list-card-title">{book.title}</h2>
                    {book.book_type ? (
                      <p className="text-xs text-violet-700 font-medium mb-1">
                        {getBookTypeLabel(book.book_type)}
                      </p>
                    ) : null}
                    {book.description ? <p className="luditeca-app-list-card-desc">{book.description}</p> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </AppStatusBlock>
    </AppShell>
  );
}
