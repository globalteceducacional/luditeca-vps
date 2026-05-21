import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Col, Form, Input, InputGroup, InputGroupAddon, InputGroupText, Row } from 'reactstrap';
import { useAuth } from '../../contexts/auth';
import Layout from '../../components/Layout';
import ArgonCmsShell from '../../components/argon/ArgonCmsShell';
import ArgonFormCard from '../../components/argon/ArgonFormCard';
import { LuditecaAlert, LuditecaButton, LuditecaInput } from '../../components/argon/luditeca';
import { useCmsTheme } from '../../contexts/cmsTheme';
import { CMS_THEME_MODE_LABELS } from '../../lib/cmsTheme';
import { apiFetch } from '../../lib/apiClient';
import { uploadFile } from '../../lib/storageApi';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, updateUserData } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { mode: cmsThemeMode, setMode: setCmsThemeMode } = useCmsTheme();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    else if (user) {
      setEmail(user.email || '');
      setName(user.user_metadata?.name || user.name || '');
      if (user.user_metadata?.avatar_url) setPhotoPreview(user.user_metadata.avatar_url);
    }
  }, [loading, user, router]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      const { url } = await uploadFile('avatars', file.name, file);
      setPhotoPreview(url || '');
      setMessage({ type: 'success', text: 'Imagem enviada.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error?.message || 'Falha no upload.' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      setIsSaving(true);
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: { name: name.trim() || null, avatar_url: photoPreview || null },
      });
      if (updateUserData) await updateUserData();
      setMessage({ type: 'success', text: 'Perfil atualizado.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message || 'Falha ao atualizar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'danger', text: 'As senhas não coincidem.' });
      return;
    }
    try {
      setIsSaving(true);
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Senha alterada.' });
    } catch (error) {
      setMessage({
        type: 'danger',
        text: error.message || 'Falha ao alterar senha.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <Layout>
        <ArgonCmsShell contentConstrained title="Perfil" loading loadingLabel="A carregar perfil…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>Meu Perfil | Luditeca</title>
      </Head>
      <ArgonCmsShell contentConstrained title="Meu Perfil" subtitle="Dados da conta e alteração de senha.">
        {message.text ? <LuditecaAlert color={message.type}>{message.text}</LuditecaAlert> : null}
        <Row>
          <Col lg="6" className="mb-4">
            <ArgonFormCard title="Informações">
              <Form onSubmit={handleUpdateProfile}>
                <div className="text-center mb-4">
                  <span className="avatar avatar-xl rounded-circle">
                    {photoPreview ? (
                      <img alt="" src={photoPreview} />
                    ) : (
                      <span className="avatar avatar-xl rounded-circle bg-primary text-white d-flex align-items-center justify-content-center">
                        {(name || email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <LuditecaInput
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    hint={uploadingAvatar ? 'A enviar…' : undefined}
                    formGroupClassName="mt-3"
                  />
                  {photoPreview ? (
                    <LuditecaButton variant="link" size="sm" type="button" onClick={() => setPhotoPreview('')}>
                      Remover foto
                    </LuditecaButton>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-control-label">Nome</label>
                  <InputGroup className="input-group-alternative mb-3">
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>
                        <i className="ni ni-single-02" />
                      </InputGroupText>
                    </InputGroupAddon>
                    <Input
                      className="luditeca-form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <div className="form-group">
                  <label className="form-control-label">Email</label>
                  <InputGroup className="input-group-alternative">
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>
                        <i className="ni ni-email-83" />
                      </InputGroupText>
                    </InputGroupAddon>
                    <Input value={email} disabled />
                  </InputGroup>
                  <small className="text-muted">O email não pode ser alterado.</small>
                </div>
                <LuditecaButton
                  variant="primary"
                  type="submit"
                  block
                  loading={isSaving}
                  loadingLabel="A guardar…"
                >
                  Guardar perfil
                </LuditecaButton>
              </Form>
            </ArgonFormCard>
          </Col>
          <Col lg="6" className="mb-4">
            <ArgonFormCard title="Alterar senha">
              <Form onSubmit={handleChangePassword}>
                <LuditecaInput
                  label="Senha atual"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <LuditecaInput
                  label="Nova senha"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <LuditecaInput
                  label="Confirmar"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <LuditecaButton
                  variant="primary"
                  type="submit"
                  block
                  loading={isSaving}
                  loadingLabel="A alterar…"
                >
                  Alterar senha
                </LuditecaButton>
              </Form>
            </ArgonFormCard>
          </Col>
          <Col lg="12">
            <ArgonFormCard title="Aparência do painel">
              <LuditecaInput
                label="Tema"
                type="select"
                value={cmsThemeMode}
                onChange={(e) => setCmsThemeMode(e.target.value)}
                hint="Claro, escuro ou conforme o sistema. Não afecta a área /app."
              >
                {Object.entries(CMS_THEME_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </LuditecaInput>
            </ArgonFormCard>
          </Col>
        </Row>
      </ArgonCmsShell>
    </Layout>
  );
}
