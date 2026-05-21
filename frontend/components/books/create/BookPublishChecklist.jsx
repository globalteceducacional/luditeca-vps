import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { Button } from 'reactstrap';
import { getBookPublishChecklist } from '../../../lib/bookPublishChecklist';

export default function BookPublishChecklist({ bookType, form, onGoToStep, compact = false }) {
  const { ready, items, pendingCount } = getBookPublishChecklist(bookType, form);

  if (!items.length) return null;

  return (
    <div className={`mb-4 p-3 rounded border ${ready ? 'border-success bg-light' : 'border-warning'}`}>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-2">
        <p className="small font-weight-bold text-uppercase text-muted mb-0">
          Checklist para publicar
        </p>
        {ready ? (
          <span className="small text-success font-weight-bold">
            <FiCheckCircle className="mr-1" />
            Pronto para publicar
          </span>
        ) : (
          <span className="small text-warning font-weight-bold">
            <FiAlertCircle className="mr-1" />
            {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <ul className={`list-unstyled mb-0 ${compact ? 'small' : ''}`}>
        {items.map((item) => (
          <li key={item.id} className="d-flex flex-wrap align-items-start mb-2">
            {item.done ? (
              <FiCheckCircle className="text-success mr-2 mt-1 flex-shrink-0" size={16} />
            ) : (
              <FiAlertCircle
                className={`mr-2 mt-1 flex-shrink-0 ${item.required ? 'text-warning' : 'text-muted'}`}
                size={16}
              />
            )}
            <div className="flex-grow-1">
              <span className={item.done ? 'text-muted' : item.required ? 'text-dark font-weight-bold' : 'text-muted'}>
                {item.label}
                {!item.required ? <span className="font-weight-normal"> (opcional)</span> : null}
              </span>
              {item.hint && !item.done ? (
                <p className="small text-danger mb-0 mt-1">{item.hint}</p>
              ) : null}
              {!item.done && item.step != null && onGoToStep ? (
                <Button
                  color="link"
                  className="p-0 small"
                  type="button"
                  onClick={() => onGoToStep(item.step)}
                >
                  Ir corrigir →
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { getBookPublishChecklist };
