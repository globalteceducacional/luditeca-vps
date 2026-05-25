import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import ArgonAuth from '../layouts/ArgonAuth';
import LuditecaAuthCard from '../components/auth/LuditecaAuthCard';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../components/argon/luditeca';
import { useAuth } from '../contexts/auth';
import { ROLES } from '../lib/roles';

function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      className="btn btn-link btn-sm luditeca-auth-password-toggle p-0"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
    >
      {visible ? <FiEyeOff size={18} aria-hidden /> : <FiEye size={18} aria-hidden />}
    </button>
  );
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.success) throw new Error(result.error || 'Falha no login');
      const role = result.user?.role;
      if (role === ROLES.aluno || role === ROLES.professor) {
        router.push('/app');
      } else {
        router.push('/books');
      }
    } catch (err) {
      const fallback = 'Não foi possível iniciar sessão. Verifique o email e a palavra-passe.';
      const msg = typeof err?.message === 'string' ? err.message.trim() : '';
      setError(msg && msg !== 'Failed to fetch' ? msg : fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Iniciar sessão | Luditeca</title>
        <meta name="description" content="Acesso à plataforma Luditeca — CMS e app educativa." />
      </Head>

      <LuditecaAuthCard
        title="Bem-vindo de volta"
        subtitle="Utilize o email e a palavra-passe da sua conta."
        footer={
          <p className="mb-0 text-center">
            <Link href="/forgot-password" className="luditeca-auth-link">
              Esqueceu a palavra-passe?
            </Link>
          </p>
        }
      >
        {error ? (
          <LuditecaAlert color="danger" className="mb-4">
            {error}
          </LuditecaAlert>
        ) : null}

        <form onSubmit={handleLogin} noValidate>
          <LuditecaInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="nome@escola.pt"
          />

          <LuditecaInput
            label="Palavra-passe"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            placeholder="••••••••"
            labelAction={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            }
          />

          <LuditecaButton
            type="submit"
            variant="primary"
            className="w-100 mt-2"
            size="lg"
            loading={loading}
            loadingLabel="A iniciar sessão…"
            disabled={loading}
          >
            Entrar
          </LuditecaButton>
        </form>

        <p className="luditeca-auth-hint text-muted mb-0 mt-4">
          Editores e administradores entram no CMS. Alunos e professores são encaminhados para a
          experiência em <strong>/app</strong>.
        </p>
      </LuditecaAuthCard>
    </>
  );
}

LoginPage.layout = ArgonAuth;

export default LoginPage;
