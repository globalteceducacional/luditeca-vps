import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../../contexts/auth';
import AppShell from '../../../components/app/AppShell';
import { getAppActivity } from '../../../lib/appContent';
import { APP_ROLES, isRole } from '../../../lib/roles';

export default function AppActivityPlayerPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, APP_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await getAppActivity(id);
    if (err) setError(err.message);
    else setActivity(data);
    setLoading(false);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setDone(false);
  }, [id]);

  useEffect(() => {
    if (user && isRole(user, APP_ROLES) && id) load();
  }, [user, id, load]);

  const questions = useMemo(() => {
    const q = activity?.questions;
    return Array.isArray(q) ? q : [];
  }, [activity]);

  const current = questions[index];
  const isQuiz = activity?.type === 'quiz' || activity?.type === 'trueFalse';

  const submitAnswer = (optionIndex) => {
    if (!isQuiz || selected !== null || !current) return;
    setSelected(optionIndex);
    const correct =
      typeof current.correct === 'number'
        ? optionIndex === current.correct
        : optionIndex === current.correctIndex;
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (index + 1 >= questions.length) setDone(true);
      else {
        setIndex((i) => i + 1);
        setSelected(null);
      }
    }, 800);
  };

  if (authLoading || !user) return null;

  const options = current?.options || current?.answers || [];

  return (
    <AppShell title={activity?.title || 'Atividade'} backHref="/app/activities">
      {loading && <p className="text-luditeca-body">A carregar…</p>}
      {error && (
        <p className="text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
      )}
      {activity && !loading && !error && (
        <div className="app-card p-6">
          {activity.description && (
            <p className="text-luditeca-body mb-4">{activity.description}</p>
          )}
          {questions.length === 0 && (
            <p className="text-luditeca-muted">Esta atividade ainda não tem perguntas.</p>
          )}
          {done && (
            <p className="text-lg font-semibold text-luditeca-accent-800">
              Concluído! Acertos: {score} / {questions.length}
            </p>
          )}
          {!done && current && isQuiz && (
            <>
              <p className="text-sm text-luditeca-accent-700 mb-2">
                Pergunta {index + 1} de {questions.length}
              </p>
              <h2 className="text-xl font-bold text-luditeca-ink mb-4">
                {current.question || current.prompt || current.text}
              </h2>
              <ul className="space-y-2">
                {options.map((opt, i) => {
                  const label = typeof opt === 'string' ? opt : opt?.text || opt?.label;
                  const isCorrect =
                    selected !== null &&
                    (i === current.correct || i === current.correctIndex);
                  const isWrong = selected === i && !isCorrect;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        disabled={selected !== null}
                        onClick={() => submitAnswer(i)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                          isCorrect
                            ? 'border-green-400 bg-green-50'
                            : isWrong
                              ? 'border-red-300 bg-red-50'
                              : 'border-luditeca-primary-100 hover:border-luditeca-accent-300 hover:bg-luditeca-accent-soft'
                        }`}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {!done && current && !isQuiz && (
            <p className="text-luditeca-muted">
              Tipo &quot;{activity.type}&quot;: player completo em breve (
              {questions.length} cartão{questions.length === 1 ? '' : 's'}).
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
