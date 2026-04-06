import '../styles/globals.css';
import '../styles/fonts.css';
import { AuthProvider } from '../contexts/auth';
import { devLog } from '../lib/devLog';

function MyApp({ Component, pageProps }) {
  devLog('_app renderizado');
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp; 