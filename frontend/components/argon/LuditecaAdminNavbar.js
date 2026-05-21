import { useRouter } from 'next/router';
import {
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  Navbar,
  Container,
  UncontrolledDropdown,
} from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import LuditecaThemeToggle from './LuditecaThemeToggle';

export default function LuditecaAdminNavbar({ brandText = 'Luditeca' }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <Navbar
      className="navbar-top navbar-light luditeca-navbar-top border-bottom"
      expand="md"
      id="navbar-main"
    >
      <Container fluid className="d-flex align-items-center flex-wrap">
        <span className="h4 mb-0 text-white text-uppercase d-none d-lg-inline-block">
          {brandText}
        </span>
        <Nav className="align-items-center ml-auto" navbar>
          <LuditecaThemeToggle className="mr-2" />
          <UncontrolledDropdown nav inNavbar>
            <DropdownToggle className="pr-0" nav caret>
              <span className="avatar avatar-sm rounded-circle bg-white text-default d-inline-flex align-items-center justify-content-center">
                {(user?.email || 'U').charAt(0).toUpperCase()}
              </span>
              <span className="ml-2 text-sm text-white d-none d-lg-inline">
                {user?.email || 'Utilizador'}
              </span>
            </DropdownToggle>
            <DropdownMenu className="dropdown-menu-arrow" right>
              <DropdownItem header className="text-overflow m-0">
                {user?.role || '—'}
              </DropdownItem>
              <DropdownItem onClick={() => router.push('/profile')}>Perfil</DropdownItem>
              <DropdownItem divider />
              <DropdownItem onClick={handleLogout}>Sair</DropdownItem>
            </DropdownMenu>
          </UncontrolledDropdown>
        </Nav>
      </Container>
    </Navbar>
  );
}
