/**
 * Alerta Bootstrap sem reactstrap/Fade — evita avisos defaultProps/findDOMNode em dev (React 18).
 */
export default function LuditecaAlert({
  color = 'info',
  className = '',
  children,
  role = 'alert',
}) {
  const extra = className ? ` ${className}` : '';
  return (
    <div className={`alert alert-${color}${extra}`} role={role}>
      {children}
    </div>
  );
}
