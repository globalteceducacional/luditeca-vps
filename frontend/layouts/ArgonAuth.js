import { useEffect } from 'react';
import { Container, Row, Col } from 'reactstrap';

export default function ArgonAuth({ children }) {
  useEffect(() => {
    document.body.classList.add('bg-default');
    return () => document.body.classList.remove('bg-default');
  }, []);

  return (
    <>
      <div className="main-content">
        <div className="header bg-gradient-info py-7 py-lg-8">
          <Container>
            <div className="header-body text-center mb-7">
              <Row className="justify-content-center">
                <Col lg="5" md="6">
                  <h1 className="text-white">Luditeca</h1>
                  <p className="text-lead text-light">
                    Plataforma educativa — entre com as suas credenciais.
                  </p>
                </Col>
              </Row>
            </div>
          </Container>
          <div className="separator separator-bottom separator-skew zindex-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
              version="1.1"
              viewBox="0 0 2560 100"
              x="0"
              y="0"
            >
              <polygon className="fill-default" points="2560 0 2560 100 0 100" />
            </svg>
          </div>
        </div>
        <Container className="mt--8 pb-5">
          <Row className="justify-content-center">{children}</Row>
        </Container>
      </div>
      <footer className="py-4 text-center text-muted text-sm">
        <a
          href="https://www.creative-tim.com/product/argon-dashboard-react"
          target="_blank"
          rel="noreferrer"
        >
          Argon Dashboard
        </a>{' '}
        · Creative Tim (MIT)
      </footer>
    </>
  );
}
