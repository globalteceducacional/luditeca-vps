import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Col } from 'reactstrap';
import ArgonAuth from '../layouts/ArgonAuth';
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
    <Col lg="5" md="7">
      <Head>
        <title>Recuperar senha | Luditeca CMS</title>
      </Head>
      <div className="card bg-secondary shadow border-0 p-4 p-lg-5">
        <h1 className="text-center mb-2">Recuperar acesso</h1>
        <p className="text-muted text-center mb-4">
          Indique o email da conta. Por segurança, a resposta é sempre genérica.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'A enviar…' : 'Pedir recuperação'}
          </button>
        </form>

        <p className="mt-4 text-center">
          <Link href="/login">Voltar ao login</Link>
        </p>
      </div>
    </Col>
  );
}

ForgotPassword.layout = ArgonAuth;

export default ForgotPassword;
