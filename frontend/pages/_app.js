import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'animate.css';
import '../styles/globals.css';
import '../styles/fonts.css';
import '../styles/argon-luditeca.css';

import { AuthProvider } from '../contexts/auth';
import { devLog } from '../lib/devLog';

function Passthrough({ children }) {
  return children;
}

function LuditecaApp({ Component, pageProps }) {
  const Layout = Component.layout || Passthrough;
  devLog('_app renderizado');
  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AuthProvider>
  );
}

export default LuditecaApp;
