import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Form,
  FormGroup,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from 'reactstrap';
import ArgonAuth from '../layouts/ArgonAuth';
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
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
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
    <Col lg="5" md="7">
      <Head>
        <title>Nova senha | Luditeca</title>
      </Head>
      <Card className="bg-secondary shadow border-0">
        <CardHeader className="bg-transparent">
          <h2 className="text-center mb-0">Definir nova senha</h2>
        </CardHeader>
        <CardBody className="px-lg-5 py-lg-5">
          {ok ? (
            <div className="text-center">
              <p className="text-success mb-4">Senha atualizada. Pode iniciar sessão.</p>
              <Button color="primary" tag={Link} href="/login">
                Ir para o login
              </Button>
            </div>
          ) : (
            <Form onSubmit={handleSubmit}>
              {error ? <div className="alert alert-danger">{error}</div> : null}
              <FormGroup>
                <InputGroup className="input-group-alternative mb-3">
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>
                      <i className="ni ni-key-25" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <Input
                    placeholder="Token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                </InputGroup>
              </FormGroup>
              <FormGroup>
                <Input
                  type="password"
                  placeholder="Nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </FormGroup>
              <FormGroup>
                <Input
                  type="password"
                  placeholder="Confirmar senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </FormGroup>
              <Button color="primary" block type="submit" disabled={loading}>
                {loading ? 'A guardar…' : 'Guardar nova senha'}
              </Button>
            </Form>
          )}
          {!ok ? (
            <p className="text-center mt-4 mb-0">
              <Link href="/login">Voltar ao login</Link>
            </p>
          ) : null}
        </CardBody>
      </Card>
    </Col>
  );
}

ResetPasswordPage.layout = ArgonAuth;

export default ResetPasswordPage;
