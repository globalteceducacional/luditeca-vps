import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Alert } from 'reactstrap';
import Layout from '../../../components/Layout';
import ArgonCmsShell from '../../../components/argon/ArgonCmsShell';
import BookTypeFlowPage from '../../../components/books/create/BookTypeFlowPage';
import { getBook } from '../../../lib/books';
import { isValidBookType } from '../../../lib/bookTypes';

export default function EditBookFlowPage() {
  const router = useRouter();
  const bookId = router.query.id ? String(router.query.id) : '';
  const [bookType, setBookType] = useState(null);
  const [missingType, setMissingType] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await getBook(bookId, { view: 'legacy' });
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      const t = data.book_type;
      if (!t || !isValidBookType(t)) {
        setMissingType(true);
        setBookType(null);
      } else {
        setBookType(t);
        setMissingType(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!bookId || loading) {
    return (
      <Layout>
        <ArgonCmsShell title="Editor por tipo" loading loadingLabel="A carregar…" />
      </Layout>
    );
  }

  if (missingType) {
    return (
      <Layout>
        <ArgonCmsShell title="Editor por tipo">
          <Alert color="info">
            Este livro foi criado no fluxo clássico (sem <code>book_type</code>). Use o{' '}
            <Link href={`/books/${bookId}/edit-v2`}>editor visual v2</Link>.
          </Alert>
          <Link href="/books">← Voltar ao catálogo</Link>
        </ArgonCmsShell>
      </Layout>
    );
  }

  if (!bookType) {
    return (
      <Layout>
        <ArgonCmsShell title="Editor por tipo">
          <Alert color="danger">Não foi possível carregar o livro.</Alert>
          <Link href="/books">← Voltar</Link>
        </ArgonCmsShell>
      </Layout>
    );
  }

  return <BookTypeFlowPage bookType={bookType} bookId={bookId} />;
}
