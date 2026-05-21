import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { LuditecaButton, LuditecaInput } from '../argon/luditeca';

const emptyQuestion = () => ({
  question: '',
  options: ['', ''],
  correct: 0,
  answer: '',
});

/** Editor mínimo de perguntas para atividades tipo quiz / trueFalse / fillBlank. */
export default function AdminQuizQuestionsEditor({ type, value, onChange }) {
  const questions = Array.isArray(value) && value.length ? value : [emptyQuestion()];

  const setQuestions = (next) => onChange(next);

  const updateAt = (idx, patch) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    setQuestions(next);
  };

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);

  const removeAt = (idx) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  if (type === 'fillBlank') {
    const q = questions[0] || emptyQuestion();
    return (
      <div className="mb-3 p-3 border rounded bg-light">
        <p className="small text-muted font-weight-bold text-uppercase mb-2">Pergunta (lacuna)</p>
        <LuditecaInput
          formGroupClassName="mb-2"
          placeholder="Complete: O céu é ___"
          value={q.question || ''}
          onChange={(e) => updateAt(0, { question: e.target.value })}
        />
        <LuditecaInput
          formGroupClassName="mb-0"
          placeholder="Resposta correta"
          value={q.answer || ''}
          onChange={(e) => updateAt(0, { answer: e.target.value })}
        />
      </div>
    );
  }

  if (type === 'trueFalse') {
    const q = questions[0] || emptyQuestion();
    return (
      <div className="mb-3 p-3 border rounded bg-light">
        <p className="small text-muted font-weight-bold text-uppercase mb-2">Afirmação</p>
        <LuditecaInput
          formGroupClassName="mb-0"
          value={q.question || ''}
          onChange={(e) =>
            updateAt(0, {
              question: e.target.value,
              options: ['Verdadeiro', 'Falso'],
              correct: q.correct === 1 ? 1 : 0,
            })
          }
        />
        <LuditecaInput
          label="Resposta correta"
          type="select"
          value={Number(q.correct) === 1 ? 1 : 0}
          onChange={(e) =>
            updateAt(0, {
              options: ['Verdadeiro', 'Falso'],
              correct: Number(e.target.value),
            })
          }
        >
          <option value={0}>Verdadeiro</option>
          <option value={1}>Falso</option>
        </LuditecaInput>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {questions.map((q, idx) => (
        <div key={idx} className="mb-3 p-3 border rounded bg-light">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-muted font-weight-bold text-uppercase">Pergunta {idx + 1}</span>
            {questions.length > 1 ? (
              <LuditecaButton
                type="button"
                variant="link"
                className="p-0 text-danger"
                onClick={() => removeAt(idx)}
                aria-label="Remover pergunta"
              >
                <FiTrash2 size={14} />
              </LuditecaButton>
            ) : null}
          </div>
          <LuditecaInput
            formGroupClassName="mb-2"
            placeholder="Enunciado"
            value={q.question || ''}
            onChange={(e) => updateAt(idx, { question: e.target.value })}
          />
          {(q.options || ['', '']).map((opt, oi) => (
            <div key={oi} className="d-flex align-items-center mt-2">
              <input
                type="radio"
                name={`correct-${idx}`}
                className="mr-2"
                checked={Number(q.correct) === oi}
                onChange={() => updateAt(idx, { correct: oi })}
              />
              <LuditecaInput
                formGroupClassName="mb-0 flex-grow-1 w-100"
                placeholder={`Opção ${oi + 1}`}
                value={opt}
                onChange={(e) => {
                  const opts = [...(q.options || [])];
                  opts[oi] = e.target.value;
                  updateAt(idx, { options: opts });
                }}
              />
            </div>
          ))}
          <LuditecaButton
            type="button"
            variant="link"
            size="sm"
            className="p-0 mt-2"
            onClick={() => updateAt(idx, { options: [...(q.options || []), ''] })}
          >
            + opção
          </LuditecaButton>
        </div>
      ))}
      <LuditecaButton
        type="button"
        variant="link"
        size="sm"
        className="p-0 d-inline-flex align-items-center"
        onClick={addQuestion}
      >
        <FiPlus size={14} className="mr-1" /> Adicionar pergunta
      </LuditecaButton>
    </div>
  );
}
