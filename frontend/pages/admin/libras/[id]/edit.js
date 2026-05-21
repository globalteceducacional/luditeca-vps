import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { Form } from 'reactstrap';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../../../components/argon/luditeca';
import AdminImageUploadField from '../../../../components/admin/AdminImageUploadField';
import Layout from '../../../../components/Layout';
import ArgonCmsShell from '../../../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../../../components/argon/ArgonFormCard';
import { useAuth } from '../../../../contexts/auth';
import { createLibrasLesson, getLibrasLesson, updateLibrasLesson } from '../../../../lib/librasLessons';
import { CMS_ROLES, isRole } from '../../../../lib/roles';

const emptyForm = () => ({
  word: '',
  category: '',
  image_url: '',
  description: '',
  quiz_question: '',
  quiz_options: ['', '', '', ''],
  quiz_correct: 0,
  sort_order: 0,
});

export default function AdminLibrasEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !isRole(user, CMS_ROLES)) router.replace('/books');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!id || isNew) return;
    (async () => {
      setLoading(true);
      const { data, error: err } = await getLibrasLesson(id);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const opts = Array.isArray(data.quiz_options) ? data.quiz_options : ['', '', '', ''];
      while (opts.length < 4) opts.push('');
      setForm({
        word: data.word || '',
        category: data.category || '',
        image_url: data.image_url || '',
        description: data.description || '',
        quiz_question: data.quiz_question || '',
        quiz_options: opts.slice(0, 4),
        quiz_correct: data.quiz_correct ?? 0,
        sort_order: data.sort_order ?? 0,
      });
      setLoading(false);
    })();
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.word.trim()) {
      toast.error('Palavra obrigatória.');
      return;
    }
    setSaving(true);
    const payload = {
      word: form.word.trim(),
      category: form.category?.trim() || null,
      image_url: form.image_url?.trim() || null,
      description: form.description?.trim() || null,
      quiz_question: form.quiz_question?.trim() || null,
      quiz_options: form.quiz_options.filter((o) => String(o).trim()),
      quiz_correct: Number(form.quiz_correct) || 0,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error: err } = isNew
      ? await createLibrasLesson(payload)
      : await updateLibrasLesson(id, payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success(isNew ? 'Lição criada.' : 'Lição guardada.');
    router.push('/admin/libras');
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>{isNew ? 'Nova lição LIBRAS' : 'Editar LIBRAS'} | Admin</title>
      </Head>
      <ArgonCmsShell
        contentConstrained
        title={isNew ? 'Nova lição LIBRAS' : 'Editar lição'}
        subtitle="Palavra, imagem e quiz opcional."
        loading={loading}
        headerExtra={
          <LuditecaButton variant="link" size="sm" tag={Link} href="/admin/libras" className="p-0">
            ← Voltar
          </LuditecaButton>
        }
      >
        <ArgonFormCard title="Conteúdo">
          <Form onSubmit={handleSubmit}>
            {error ? <LuditecaAlert color="danger">{error}</LuditecaAlert> : null}
            <LuditecaInput
              label="Palavra / sinal"
              required
              value={form.word}
              onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
            />
            <LuditecaInput
              label="Categoria"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
            <AdminImageUploadField
              label="Imagem ilustrativa"
              uploadKind="libras"
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            />
            <LuditecaInput
              label="Descrição"
              type="textarea"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <hr />
            <h4 className="heading-small text-muted mb-3">Quiz opcional</h4>
            <LuditecaInput
              label="Pergunta"
              value={form.quiz_question}
              onChange={(e) => setForm((f) => ({ ...f, quiz_question: e.target.value }))}
            />
            {form.quiz_options.map((opt, i) => (
              <div key={i} className="d-flex align-items-center mb-3">
                <input
                  type="radio"
                  name="quiz_correct"
                  className="mr-2"
                  checked={form.quiz_correct === i}
                  onChange={() => setForm((f) => ({ ...f, quiz_correct: i }))}
                />
                <LuditecaInput
                  formGroupClassName="mb-0 flex-grow-1 w-100"
                  placeholder={`Opção ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const quiz_options = [...form.quiz_options];
                    quiz_options[i] = e.target.value;
                    setForm((f) => ({ ...f, quiz_options }));
                  }}
                />
              </div>
            ))}
            <LuditecaButton variant="primary" type="submit" disabled={saving} loading={saving} block>
              {isNew ? 'Criar lição' : 'Guardar'}
            </LuditecaButton>
          </Form>
        </ArgonFormCard>
      </ArgonCmsShell>
    </Layout>
  );
}
