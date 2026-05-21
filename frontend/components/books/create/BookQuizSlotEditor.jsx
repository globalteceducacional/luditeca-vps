import { FiTrash2 } from 'react-icons/fi';
import { LuditecaButton, LuditecaInput } from '../../argon/luditeca';

/** Uma pergunta de quiz numa posição da timeline editorial. */
export default function BookQuizSlotEditor({ item, onChange, onRemove, canRemove }) {
  const options = Array.isArray(item?.options) && item.options.length >= 2 ? item.options : ['', '', '', ''];
  const correct = Number.isFinite(Number(item?.correct)) ? Number(item.correct) : 0;

  const patch = (patchObj) => onChange({ ...item, page_type: 'quiz', ...patchObj });

  return (
    <div>
      <LuditecaInput
        label="Pergunta"
        placeholder="Enunciado do quiz"
        value={item?.question || ''}
        onChange={(e) => patch({ question: e.target.value })}
      />
      <p className="small text-muted font-weight-bold text-uppercase mb-2">Opções (marque a correta)</p>
      {options.map((opt, oi) => (
        <div key={oi} className="d-flex align-items-center mb-2">
          <input
            type="radio"
            name={`quiz-correct-${item?.page_number ?? 0}`}
            className="mr-2"
            checked={correct === oi}
            onChange={() => patch({ correct: oi })}
          />
          <LuditecaInput
            className="flex-grow-1 mb-0"
            formGroupClassName="mb-0 flex-grow-1"
            placeholder={`Opção ${oi + 1}`}
            value={opt}
            onChange={(e) => {
              const opts = [...options];
              opts[oi] = e.target.value;
              patch({ options: opts });
            }}
          />
        </div>
      ))}
      <LuditecaButton
        type="button"
        variant="link"
        size="sm"
        className="p-0 mb-2"
        onClick={() => patch({ options: [...options, ''] })}
      >
        + opção
      </LuditecaButton>
      {canRemove ? (
        <LuditecaButton type="button" variant="link" className="p-0 text-danger" onClick={onRemove}>
          <FiTrash2 size={14} className="mr-1" />
          Remover pergunta
        </LuditecaButton>
      ) : null}
    </div>
  );
}
