/* Bootstrap + Font Awesome: /vendor/* via _document.js (evita injector CSS no browser) */
/* animate.css só no editor v2 / propriedades — evita CSS global no CMS */
import '../styles/tokens.css';
import '../styles/globals.css';
import '../styles/fonts.css';
import '../styles/argon-luditeca.css';
import '../styles/luditeca-ds.css';

import { AuthProvider } from '../contexts/auth';
import { CmsThemeProvider } from '../contexts/cmsTheme';
import { devLog } from '../lib/devLog';

function Passthrough({ children }) {
  return children;
}

function LuditecaApp({ Component, pageProps }) {
  const Layout = Component.layout || Passthrough;
  devLog('_app renderizado');
  return (
    <AuthProvider>
      <CmsThemeProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </CmsThemeProvider>
    </AuthProvider>
  );
}

export default LuditecaApp;
