import { useRouter } from 'next/router';
import { Nav, Navbar, NavbarBrand, NavItem, NavLink } from 'reactstrap';
import { useCallback, useState } from 'react';

const SHAPE_FALLBACK = 'default';

function NavRouteItem({ route, active, onNavigate }) {
  const shape = route.shape || SHAPE_FALLBACK;
  return (
    <NavItem active={active} className="luditeca-sidenav-item">
      <NavLink
        href={route.path}
        active={active}
        className="d-flex align-items-center rounded luditeca-sidenav-link"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(route.path);
        }}
      >
        <span className={`icon-shape icon-sm mr-3 icon-shape-${shape}`}>
          <i className={route.icon} />
        </span>
        <span className="nav-link-text">{route.name}</span>
      </NavLink>
    </NavItem>
  );
}

/**
 * @param {{ routes?: object[], groups?: { id: string, label: string, items: object[] }[], brandHref?: string, brandLabel?: string }} props
 */
export default function LuditecaSidebar({
  routes = [],
  groups = null,
  brandHref = '/books',
  brandLabel = 'Luditeca',
}) {
  const router = useRouter();
  const [collapseOpen, setCollapseOpen] = useState(true);

  const closeOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches) {
      setCollapseOpen(false);
    }
  }, []);

  const isActive = (path) => {
    if (path === '/admin') {
      if (router.pathname === '/admin') return true;
      if (!router.pathname.startsWith('/admin/')) return false;
      return (
        !router.pathname.startsWith('/admin/users') &&
        !router.pathname.startsWith('/admin/audit') &&
        !router.pathname.startsWith('/admin/telemetry')
      );
    }
    return router.pathname === path || router.pathname.startsWith(`${path}/`);
  };

  const onNavigate = (path) => {
    router.push(path);
    closeOnMobile();
  };

  const navGroups =
    groups && groups.length > 0
      ? groups
      : [{ id: 'default', label: null, items: routes }];

  return (
    <Navbar
      className="navbar-vertical fixed-left navbar-expand-md navbar-light bg-white luditeca-sidenav"
      expand="md"
      id="sidenav-main"
    >
      <div className="container-fluid">
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setCollapseOpen(!collapseOpen)}
          aria-label="Menu"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="luditeca-sidenav-brand border-bottom pb-3 mb-3">
          <NavbarBrand
            href={brandHref}
            className="pt-0 mr-0"
            onClick={(e) => {
              e.preventDefault();
              router.push(brandHref);
            }}
          >
            <span className="h3 mb-0 font-weight-bold text-primary">{brandLabel}</span>
            <small className="d-block text-muted font-weight-normal mt-1 small">Painel editorial</small>
          </NavbarBrand>
        </div>
        <div className={`navbar-collapse collapse ${collapseOpen ? 'show' : ''}`.trim()}>
          <Nav navbar className="flex-column luditeca-sidenav-nav">
            {navGroups.map((group) => (
              <div key={group.id} className="luditeca-sidenav-group">
                {group.label ? (
                  <span className="luditeca-sidenav-section-label">{group.label}</span>
                ) : null}
                {group.items.map((route) => (
                  <NavRouteItem
                    key={route.path}
                    route={route}
                    active={isActive(route.path)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))}
          </Nav>
        </div>
      </div>
    </Navbar>
  );
}
