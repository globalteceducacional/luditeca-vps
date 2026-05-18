import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import {
  Alert,
  Button,
  CustomInput,
  Form,
  FormGroup,
  Input,
  Row,
  Col,
  Spinner,
} from 'reactstrap';
import AdminQuizQuestionsEditor from '../../../../components/admin/AdminQuizQuestionsEditor';
import Layout from '../../../../components/Layout';
import ArgonCmsShell from '../../../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../../../components/argon/ArgonFormCard';
import { useAuth } from '../../../../contexts/auth';
import { createActivity, getActivity, updateActivity } from '../../../../lib/activities';
import { CMS_ROLES, isRole } from '../../../../lib/roles';

const ACTIVITY_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'flashcard', label: 'Flashcard' },
  { value: 'trueFalse', label: 'Verdadeiro / Falso' },
  { value: 'fillBlank', label: 'Preencher lacuna' },
];

const emptyForm = () => ({
  title: '',
  description: '',
  icon: '🎯',
  type: 'quiz',
  questions: [{ question: '', options: ['', ''], correct: 0 }],
  badge_reward: '',
  is_published: false,
});

export default function AdminActivityEditPage() {
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
      const { data, error: err } = await getActivity(id);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setForm({
        title: data.title || '',
        description: data.description || '',
        icon: data.icon || '🎯',
        type: data.type || 'quiz',
        questions:
          Array.isArray(data.questions) && data.questions.length
            ? data.questions
            : emptyForm().questions,
        badge_reward: data.badge_reward || '',
        is_published: Boolean(data.is_published),
      });
      setLoading(false);
    })();
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Título obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      icon: form.icon?.trim() || null,
      type: form.type,
      questions: form.questions,
      badge_reward: form.badge_reward?.trim() || null,
      is_published: form.is_published,
    };
    const { error: err } = isNew
      ? await createActivity(payload)
      : await updateActivity(id, payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      toast.error(err.message);
      return;
    }
    toast.success(isNew ? 'Atividade criada.' : 'Atividade guardada.');
    router.push('/admin/activities');
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <Head>
        <title>{isNew ? 'Nova atividade' : 'Editar atividade'} | Admin</title>
      </Head>
      <ArgonCmsShell
        title={isNew ? 'Nova atividade' : 'Editar atividade'}
        subtitle="Configure tipo, perguntas e publicação."
        loading={loading}
        headerExtra={
          <Button color="link" size="sm" tag={Link} href="/admin/activities" className="p-0">
            ← Voltar
          </Button>
        }
      >
        <ArgonFormCard title="Dados da atividade">
          <Form onSubmit={handleSubmit}>
            {error ? <Alert color="danger">{error}</Alert> : null}
            <FormGroup>
              <label className="form-control-label">Título *</label>
              <Input
                className="luditeca-form-control"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </FormGroup>
            <FormGroup>
              <label className="form-control-label">Descrição</label>
              <Input
                className="luditeca-form-control"
                type="textarea"
                rows="3"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </FormGroup>
            <Row>
              <Col md="3">
                <FormGroup>
                  <label className="form-control-label">Ícone</label>
                  <Input
                    className="luditeca-form-control"
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  />
                </FormGroup>
              </Col>
              <Col md="9">
                <FormGroup>
                  <label className="form-control-label">Tipo</label>
                  <Input
                    className="luditeca-form-control"
                    type="select"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <AdminQuizQuestionsEditor
              type={form.type}
              value={form.questions}
              onChange={(questions) => setForm((f) => ({ ...f, questions }))}
            />
            <FormGroup>
              <label className="form-control-label">Badge reward</label>
              <Input
                className="luditeca-form-control"
                placeholder="Opcional"
                value={form.badge_reward}
                onChange={(e) => setForm((f) => ({ ...f, badge_reward: e.target.value }))}
              />
            </FormGroup>
            <CustomInput
              type="checkbox"
              id="activity-published"
              label="Publicado"
              checked={form.is_published}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
            />
            <Button color="primary" type="submit" disabled={saving} block className="mt-4">
              {saving ? <Spinner size="sm" /> : isNew ? 'Criar atividade' : 'Guardar'}
            </Button>
          </Form>
        </ArgonFormCard>
      </ArgonCmsShell>
    </Layout>
  );
}
