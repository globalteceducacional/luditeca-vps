import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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
  Row,
} from 'reactstrap';
import ArgonAuth from '../layouts/ArgonAuth';
import { useAuth } from '../contexts/auth';
import { ROLES } from '../lib/roles';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) throw new Error(result.error || 'Falha no login');
      const role = result.user?.role;
      if (role === ROLES.aluno || role === ROLES.professor) {
        router.push('/app');
      } else {
        router.push('/books');
      }
    } catch (err) {
      const fallback = 'Falha ao fazer login. Verifique email e senha.';
      const msg = typeof err?.message === 'string' ? err.message.trim() : '';
      setError(msg && msg !== 'Failed to fetch' ? msg : fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Col lg="5" md="7">
      <Card className="bg-secondary shadow border-0">
        <CardHeader className="bg-transparent pb-4">
          <div className="text-muted text-center mt-2">
            <h2 className="text-default">Entrar</h2>
          </div>
        </CardHeader>
        <CardBody className="px-lg-5 py-lg-5">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <Form onSubmit={handleLogin} role="form">
            <FormGroup className="mb-3">
              <InputGroup className="input-group-alternative">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>
                    <i className="ni ni-email-83" />
                  </InputGroupText>
                </InputGroupAddon>
                <Input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </InputGroup>
            </FormGroup>
            <FormGroup>
              <InputGroup className="input-group-alternative">
                <InputGroupAddon addonType="prepend">
                  <InputGroupText>
                    <i className="ni ni-lock-circle-open" />
                  </InputGroupText>
                </InputGroupAddon>
                <Input
                  placeholder="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </InputGroup>
            </FormGroup>
            <div className="text-center">
              <Button className="my-4" color="primary" type="submit" disabled={loading}>
                {loading ? 'A entrar…' : 'Entrar'}
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
      <Row className="mt-3">
        <Col className="text-center" xs="12">
          <Link href="/forgot-password" className="text-light">
            <small>Esqueceu a senha?</small>
          </Link>
        </Col>
      </Row>
    </Col>
  );
}

LoginPage.layout = ArgonAuth;

export default LoginPage;
