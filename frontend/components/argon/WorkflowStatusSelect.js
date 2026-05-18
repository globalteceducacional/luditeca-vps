import classNames from 'classnames';
import { Input } from 'reactstrap';

export const WORKFLOW_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Revisão' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivo' },
];

export const WORKFLOW_LABEL = Object.fromEntries(
  WORKFLOW_OPTIONS.map((o) => [o.value, o.label]),
);

export function workflowBadgeColor(status) {
  switch (status) {
    case 'published':
      return 'success';
    case 'review':
      return 'warning';
    case 'archived':
      return 'secondary';
    default:
      return 'info';
  }
}

export default function WorkflowStatusSelect({
  value,
  onChange,
  disabled,
  size = 'sm',
  className = '',
}) {
  return (
    <Input
      type="select"
      bsSize={size}
      value={value || 'draft'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={classNames('luditeca-form-control', className)}
    >
      {WORKFLOW_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Input>
  );
}
