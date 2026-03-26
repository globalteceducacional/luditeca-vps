import '../styles/globals.css';
import '../styles/fonts.css';
import { AuthProvider } from '../contexts/auth';
import { devLog } from '../lib/devLog';

const AVAILABLE_FONTS = [
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Dosis', label: 'Dosis' }
];

function MyApp({ Component, pageProps }) {
  devLog('_app renderizado');
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp; 