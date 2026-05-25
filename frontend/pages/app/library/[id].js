import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '../../../contexts/auth';
import AppBookReader from '../../../components/app/AppBookReader';
import {
  AppAnimatedBookReader,
  AppDigitalBookReader,
  AppInteractiveBookReader,
} from '../../../components/app/AppBookTypeReaders';
import AppShell from '../../../components/app/AppShell';
import { getAppBook } from '../../../lib/appContent';
import { getFileUrl } from '../../../lib/mediaUrl';
import { getBookTypeLabel } from '../../../lib/bookTypes';
import { APP_ROLES, isRole } from '../../../lib/roles';
import { isPagesV2 } from '../../../lib/pagesV2/migrate';

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
    const { data, error: err } = await getAppBook(id, 'both');
    if (err) setError(err.message);
    else setBook(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES) && id) load();
  }, [user, id, load]);

  if (authLoading || !user) return null;

  const bookType = book?.book_type;
  const pagesV2 = book?.pages_v2;
  const legacyPages = Array.isArray(book?.pages) ? book.pages : [];
  const hasV2 = isPagesV2(pagesV2);
  const pageCount = hasV2 ? pagesV2.pages.length : legacyPages.length;
  const url = coverUrl(book);
  const typeLabel = bookType ? getBookTypeLabel(bookType) : null;

  const renderReader = () => {
    if (bookType === 'animated') {
      return (
        <AppAnimatedBookReader
          key={book.id}
          pages={legacyPages}
          soundtrackUrl={book.soundtrack_url}
          quiz={book.quiz}
        />
      );
    }
    if (bookType === 'interactive') {
      return (
        <AppInteractiveBookReader
          key={book.id}
          bookId={book.id}
          scenes={legacyPages}
          quiz={book.quiz}
        />
      );
    }
    if (bookType === 'digital') {
      return (
        <AppDigitalBookReader key={book.id} pdfUrl={book.pdf_url} epubUrl={book.epub_url} />
      );
    }
    if (hasV2) {
      return <AppBookReader pagesV2={pagesV2} />;
    }
    if (legacyPages.length > 0) {
      return (
        <p className="text-sm text-luditeca-muted bg-luditeca-primary-50 border border-luditeca-primary-100 rounded-lg p-4">
          Este livro usa um formato antigo. Peça ao editor para publicar no editor visual v2 ou no
          fluxo por tipo.
        </p>
      );
    }
    return <p className="text-sm text-luditeca-muted">Livro sem conteúdo para leitura.</p>;
  };

  return (
    <AppShell title={book?.title || 'Livro'} backHref="/app/library">
      {loading && <p className="text-luditeca-body">A carregar…</p>}
      {error && (
        <p className="text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
      )}
      {book && (
        <article className="app-card">
          {url && (
            <div className="relative w-full aspect-[3/4] max-h-80 bg-luditeca-primary-50">
              <Image src={url} alt="" fill className="object-contain" unoptimized />
            </div>
          )}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-luditeca-ink">{book.title}</h2>
            {typeLabel ? <p className="app-badge-type mt-1">{typeLabel}</p> : null}
            {book.description && (
              <p className="text-luditeca-body mt-3 whitespace-pre-wrap">{book.description}</p>
            )}
            {book.age_range ? (
              <p className="text-sm text-luditeca-muted mt-2">Faixa etária: {book.age_range}</p>
            ) : null}
            {pageCount > 0 && !bookType ? (
              <p className="text-sm text-luditeca-muted mt-4">
                {pageCount} página{pageCount === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>
          <div className="p-4 pt-0 border-t border-luditeca-primary-100">{renderReader()}</div>
        </article>
      )}
    </AppShell>
  );
}
