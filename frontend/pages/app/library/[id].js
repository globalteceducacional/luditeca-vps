import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '../../../contexts/auth';
import AppBookReader from '../../../components/app/AppBookReader';
import AppShell from '../../../components/app/AppShell';
import { getAppBook } from '../../../lib/appContent';
import { getFileUrl } from '../../../lib/mediaUrl';
import { APP_ROLES, isRole } from '../../../lib/roles';

function coverUrl(book) {
  const raw = book?.cover_image || book?.coverImage;
  if (!raw) return null;
  if (String(raw).startsWith('http')) return raw;
  return getFileUrl('covers', raw);
}

export default function AppBookDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, APP_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await getAppBook(id, 'v2');
    if (err) setError(err.message);
    else setBook(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES) && id) load();
  }, [user, id, load]);

  if (authLoading || !user) return null;

  const pages = book?.pages_v2?.pages;
  const pageCount = Array.isArray(pages) ? pages.length : 0;
  const url = coverUrl(book);

  return (
    <AppShell title={book?.title || 'Livro'} backHref="/app/library">
      {loading && <p className="text-sky-700">A carregar…</p>}
      {error && (
        <p className="text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
      )}
      {book && (
        <article className="bg-white rounded-2xl border border-sky-100 overflow-hidden">
          {url && (
            <div className="relative w-full aspect-[3/4] max-h-80 bg-sky-50">
              <Image src={url} alt="" fill className="object-contain" unoptimized />
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-sky-900">{book.title}</h2>
            {book.description && (
              <p className="text-sky-800 mt-3 whitespace-pre-wrap">{book.description}</p>
            )}
            {pageCount > 0 && (
              <p className="text-sm text-sky-600 mt-4">
                {pageCount} página{pageCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
          {book.pages_v2 && (
            <div className="p-4 pt-0 border-t border-sky-100">
              <AppBookReader pagesV2={book.pages_v2} />
            </div>
          )}
        </article>
      )}
    </AppShell>
  );
}
