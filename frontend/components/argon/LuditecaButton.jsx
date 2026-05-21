import classNames from 'classnames';
import { Button, Spinner } from 'reactstrap';
import { editorDark } from '../../lib/editorDarkTheme';

const GRADIENT_VARIANTS = new Set(['primary', 'success']);

const EDITOR_BTN = {
  primary: editorDark.btn.primary,
  success: editorDark.btn.success,
  secondary: editorDark.btn.secondary,
  ghost: editorDark.btn.ghost,
  danger: editorDark.btn.danger,
  link: editorDark.btn.link,
  tab: editorDark.btn.tab,
  'tab-active': editorDark.btn.tabActive,
  icon: editorDark.btn.icon,
};

/**
 * Botão CMS unificado — reactstrap com classes Luditeca DS.
 * @param {'cms'|'editor-dark'} [theme]
 * @param {'primary'|'secondary'|'success'|'danger'|'ghost'|'link'|'tab'|'tab-active'|'icon'} [editorVariant] — com theme editor-dark
 */
export default function LuditecaButton({
  variant: variantProp,
  color,
  outlineColor = 'secondary',
  size = 'md',
  loading = false,
  loadingLabel,
  icon,
  iconPosition = 'left',
  className,
  children,
  disabled,
  type = 'button',
  theme = 'cms',
  editorVariant = 'primary',
  ...rest
}) {
  const variant = variantProp || color || 'primary';
  const isDisabled = disabled || loading;
  const label = loading && loadingLabel != null ? loadingLabel : children;

  if (theme === 'editor-dark') {
    const btnClass = classNames(EDITOR_BTN[editorVariant] || EDITOR_BTN.primary, className);
    return (
      <button type={type} className={btnClass} disabled={isDisabled} {...rest}>
        {loading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
        {!loading && icon && iconPosition === 'left' ? icon : null}
        {label}
        {!loading && icon && iconPosition === 'right' ? icon : null}
      </button>
    );
  }

  const isOutline = variant === 'outline' || Boolean(rest.outline);
  const btnColor = isOutline ? outlineColor : variant === 'link' ? 'link' : variant;

  const btnClass = classNames(
    isOutline && 'btn-outline',
    GRADIENT_VARIANTS.has(btnColor) && !isOutline && btnColor !== 'link' && 'luditeca-btn-gradient',
    className,
  );

  const iconEl = icon ? (
    <i className={classNames(icon, label ? (iconPosition === 'left' ? 'mr-1' : 'ml-1') : null)} />
  ) : null;

  return (
    <Button
      color={btnColor}
      size={size === 'md' ? undefined : size}
      outline={isOutline}
      className={btnClass}
      disabled={isDisabled}
      type={type}
      {...rest}
    >
      {loading ? <Spinner size="sm" className={label ? 'mr-2' : ''} /> : null}
      {!loading && icon && iconPosition === 'left' ? iconEl : null}
      {label}
      {!loading && icon && iconPosition === 'right' ? iconEl : null}
    </Button>
  );
}
