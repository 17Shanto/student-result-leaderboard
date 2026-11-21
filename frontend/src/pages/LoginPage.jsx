import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { Alert } from '../components/StateViews';

export default function LoginPage() {
  const { admin, login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (admin) return <Navigate to={location.state?.from || '/'} replace />;

  function validate() {
    const e = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="center-page">
      <form className="card login-card" onSubmit={onSubmit} noValidate>
        <h1 className="brand brand-lg">Result<span>Board</span></h1>
        <p className="muted">Administrator sign in</p>

        <Alert type="info">{!formError && sessionMessage}</Alert>
        <Alert>{formError}</Alert>

        <FormField label="Email" name="email" error={errors.email}>
          <input id="email" type="email" autoComplete="username" value={form.email} onChange={set('email')} autoFocus />
        </FormField>
        <FormField label="Password" name="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
        </FormField>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted small center">
          <Link to="/leaderboard/public">View public leaderboard</Link>
        </p>
      </form>
    </div>
  );
}
