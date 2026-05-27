import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal CMS sem reactstrap Modal/Fade (evita findDOMNode do react-transition-group em StrictMode).
 * Markup Bootstrap 4 compatível com o resto do Argon.
 */
export default function LuditecaModal({
  isOpen,
  toggle,
  title,
  children,
  footer,
  size,
  centered = true,
  className,
  bodyClassName,
  fade: _fade = false,
  zIndex = 1050,
  ...rest
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onEscape = useCallback(
    (e) => {
      if (e.key === 'Escape') toggle?.();
    },
    [toggle],
  );

  useEffect(() => {
    if (!isOpen || !mounted) return undefined;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', onEscape);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, mounted, onEscape]);

  if (!mounted || !isOpen) return null;

  const dialogClass = [
    'modal-dialog',
    centered ? 'modal-dialog-centered' : '',
    size ? `modal-${size}` : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const bodyClass = ['modal-body', bodyClassName || ''].filter(Boolean).join(' ');

  const onBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) toggle?.();
  };

  return createPortal(
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{ zIndex }}
        onMouseDown={onBackdropMouseDown}
        {...rest}
      >
        <div className={dialogClass} role="document">
          <div className="modal-content">
            {title != null ? (
              <div className="modal-header">
                <h5 className="modal-title mb-0">{title}</h5>
                <button
                  type="button"
                  className="close"
                  aria-label="Fechar"
                  onClick={() => toggle?.()}
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
            ) : null}
            <div className={bodyClass}>{children}</div>
            {footer != null ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: zIndex - 1 }} />
    </>,
    document.body,
  );
}
