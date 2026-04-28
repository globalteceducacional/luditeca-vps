import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { apiFetch } from '../lib/apiClient';

export default function ForgotPassword() {
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
        msg += ` Token (apenas ambiente de desenvolvimento): use em /reset-password?token=…`;
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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <Head>
        <title>Recuperar senha | Luditeca CMS</title>
      </Head>
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Recuperar acesso</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Indique o email da conta. Por segurança, a resposta é sempre genérica.
        </p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'A enviar…' : 'Pedir recuperação'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="text-blue-600 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
