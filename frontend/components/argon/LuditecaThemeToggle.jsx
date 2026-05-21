import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { useCmsTheme } from '../../contexts/cmsTheme';
import { CMS_THEME_MODE_LABELS } from '../../lib/cmsTheme';

/** Alternar tema do CMS: claro, escuro ou sistema. */
export default function LuditecaThemeToggle({ className = '' }) {
  const { mode, resolved, setMode } = useCmsTheme();

  const icon =
    mode === 'system' ? 'ni ni-settings-gear-65' : resolved === 'dark' ? 'ni ni-moon' : 'ni ni-sun';

  return (
    <UncontrolledDropdown nav inNavbar className={className}>
      <DropdownToggle nav className="luditeca-theme-toggle-btn" aria-label="Tema do painel">
        <i className={`${icon} luditeca-theme-toggle-icon`} />
        <span className="d-none d-md-inline ml-1 small">{CMS_THEME_MODE_LABELS[mode]}</span>
      </DropdownToggle>
      <DropdownMenu className="dropdown-menu-arrow" right>
        <DropdownItem header className="text-uppercase small">
          Tema do painel
        </DropdownItem>
        {(['light', 'dark', 'system']).map((key) => (
          <DropdownItem key={key} active={mode === key} onClick={() => setMode(key)}>
            {CMS_THEME_MODE_LABELS[key]}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}
