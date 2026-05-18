import Head from 'next/head';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

/** Shell da área infantil — tokens Argon leves (`luditeca-app-*`), sem sidebar CMS. */
export default function AppShell({ title, children, backHref = '/app' }) {
  return (
    <>
      <Head>
        <title>{title ? `${title} | App` : 'App | Luditeca'}</title>
      </Head>
      <div className="luditeca-app-shell">
        <header className="luditeca-app-header">
          <div className="luditeca-app-header-inner">
            <Link href={backHref} className="luditeca-app-back" aria-label="Voltar">
              <FiArrowLeft size={20} />
            </Link>
            <h1 className="luditeca-app-title">{title}</h1>
          </div>
        </header>
        <main className="luditeca-app-main">{children}</main>
      </div>
    </>
  );
}
