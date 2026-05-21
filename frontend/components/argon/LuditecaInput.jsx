import classNames from 'classnames';
import { FormGroup, Input } from 'reactstrap';
import { editorDark } from '../../lib/editorDarkTheme';

function fieldId(label, id) {
  if (id) return id;
  if (!label || typeof label !== 'string') return undefined;
  return `luditeca-field-${label.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
}

/**
 * Campo de formulário CMS — label + Input reactstrap com `luditeca-form-control`.
 * @param {'cms'|'editor-dark'} [theme] — `editor-dark` para painel do editor v2
 */
export default function LuditecaInput({
  label,
  labelAction,
  id,
  required = false,
  hint,
  type = 'text',
  rows,
  className,
  formGroupClassName,
  invalid,
  feedback,
  children,
  theme = 'cms',
  ...inputProps
}) {
  const fieldIdResolved = fieldId(label, id);
  const isTextarea = type === 'textarea';
  const isSelect = type === 'select';

  if (theme === 'editor-dark') {
    const controlClass = isTextarea ? editorDark.textarea : editorDark.input;
    const shared = {
      id: fieldIdResolved,
      className: classNames(controlClass, className),
      required,
      ...inputProps,
    };

    return (
      <div className={classNames('block', formGroupClassName)}>
        {label || labelAction ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            {label ? (
              <label className={editorDark.label} htmlFor={fieldIdResolved}>
                {label}
                {required ? ' *' : null}
              </label>
            ) : (
              <span />
            )}
            {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
          </div>
        ) : null}
        {isSelect ? (
          <select {...shared}>{children}</select>
        ) : isTextarea ? (
          <textarea rows={rows ?? 3} {...shared} />
        ) : (
          <input type={type} {...shared} />
        )}
        {feedback ? <p className="mt-1 text-xs text-red-400">{feedback}</p> : null}
        {hint ? <p className={editorDark.hint}>{hint}</p> : null}
      </div>
    );
  }

  return (
    <FormGroup className={formGroupClassName}>
      {label || labelAction ? (
        <div className="d-flex justify-content-between align-items-center mb-2">
          {label ? (
            <label className="form-control-label mb-0" htmlFor={fieldIdResolved}>
              {label}
              {required ? ' *' : null}
            </label>
          ) : (
            <span />
          )}
          {labelAction ? <div className="flex-shrink-0">{labelAction}</div> : null}
        </div>
      ) : null}
      <Input
        id={fieldIdResolved}
        type={isTextarea ? 'textarea' : type}
        rows={isTextarea ? rows ?? 3 : rows}
        className={classNames('luditeca-form-control', className)}
        invalid={invalid}
        required={required}
        {...inputProps}
      >
        {children}
      </Input>
      {feedback ? <div className="invalid-feedback d-block">{feedback}</div> : null}
      {hint ? <small className="form-text text-muted">{hint}</small> : null}
    </FormGroup>
  );
}
