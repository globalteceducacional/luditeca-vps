import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ArgonAuth from '../layouts/ArgonAuth';
import LuditecaAuthCard from '../components/auth/LuditecaAuthCard';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../components/argon/luditeca';
import { apiFetch } from '../lib/apiClient';

function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (router.isReady && router.query.token) {
      setToken(String(router.query.token));
    }
  }, [router.isReady, router.query.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('A nova palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token: token.trim(), password },
      });
      setOk(true);
    } catch (err) {
      setError(err.message || 'Falha ao redefinir.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Nova palavra-passe | Luditeca</title>
      </Head>

      <LuditecaAuthCard
        title="Definir nova palavra-passe"
        subtitle={
          ok
            ? 'A sua conta está pronta para um novo início de sessão.'
            : 'Introduza o token recebido e escolha uma palavra-passe segura.'
        }
        footer={
          !ok ? (
            <p className="mb-0 text-center">
              <Link href="/login" className="luditeca-auth-link">
                Voltar ao login
              </Link>
            </p>
          ) : null
        }
      >
        {ok ? (
          <div className="text-center">
            <LuditecaAlert color="success" className="mb-4">
              Palavra-passe atualizada com sucesso.
            </LuditecaAlert>
            <LuditecaButton variant="primary" tag={Link} href="/login" className="w-100" size="lg">
              Ir para o login
            </LuditecaButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? (
              <LuditecaAlert color="danger" className="mb-4">
                {error}
              </LuditecaAlert>
            ) : null}

            <LuditecaInput
              label="Token de recuperação"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              disabled={loading}
              hint="O token vem no email de recuperação ou na consola em desenvolvimento."
            />
            <LuditecaInput
              label="Nova palavra-passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              autoComplete="new-password"
            />
            <LuditecaInput
              label="Confirmar palavra-passe"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />

            <LuditecaButton
              type="submit"
              variant="primary"
              className="w-100"
              size="lg"
              loading={loading}
              loadingLabel="A guardar…"
              disabled={loading}
            >
              Guardar nova palavra-passe
            </LuditecaButton>
          </form>
        )}
      </LuditecaAuthCard>
    </>
  );
}

ResetPasswordPage.layout = ArgonAuth;

export default ResetPasswordPage;
