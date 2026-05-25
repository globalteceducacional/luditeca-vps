import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ArgonAuth from '../layouts/ArgonAuth';
import LuditecaAuthCard from '../components/auth/LuditecaAuthCard';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../components/argon/luditeca';
import { apiFetch } from '../lib/apiClient';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const json = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });
      let msg =
        'Se existir uma conta com este email, foi gerado um pedido de recuperação. Consulte a documentação em docs/EVIDENCIAS-TAREFA-3.1.md para SMTP e URL pública.';
      if (json?.dev_reset_token) {
        msg += ' Token (apenas ambiente de desenvolvimento): use em /reset-password?token=…';
        // eslint-disable-next-line no-console
        console.info('[dev] reset token', json.dev_reset_token, json.dev_reset_link);
      }
      setMessage(msg);
    } catch (err) {
      setError(err.message || 'Pedido falhou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Recuperar acesso | Luditeca</title>
      </Head>

      <LuditecaAuthCard
        title="Recuperar acesso"
        subtitle="Indique o email da conta. Por segurança, a resposta é sempre genérica."
        footer={
          <p className="mb-0 text-center">
            <Link href="/login" className="luditeca-auth-link">
              Voltar ao login
            </Link>
          </p>
        }
      >
        {error ? (
          <LuditecaAlert color="danger" className="mb-4">
            {error}
          </LuditecaAlert>
        ) : null}
        {message ? (
          <LuditecaAlert color="success" className="mb-4">
            {message}
          </LuditecaAlert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <LuditecaInput
            label="Email"
            type="email"
            id="forgot-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="nome@escola.pt"
          />
          <LuditecaButton
            type="submit"
            variant="primary"
            className="w-100"
            size="lg"
            loading={loading}
            loadingLabel="A enviar…"
            disabled={loading}
          >
            Pedir recuperação
          </LuditecaButton>
        </form>
      </LuditecaAuthCard>
    </>
  );
}

ForgotPassword.layout = ArgonAuth;

export default ForgotPassword;
