import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LOGO } from '../assets/logo.js';
import { useAdmin } from '../lib/useAdmin.js';
import ThemeButton from '../components/ThemeButton.jsx';

export default function Login() {
  const { admin, ready, signIn } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Sign in · Torii Admin'; }, []);

  if (ready && admin) return <Navigate to={location.state?.from || '/admin'} replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-mark">
          <img src={LOGO} alt="Torii" />
          <ThemeButton />
        </div>

        <h1>Admin sign in</h1>
        <p className="sub">
          The schedule board is open to everyone. Signing in is only needed to create
          or change it.
        </p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="username" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link className="login-back" to="/">← Back to the schedule board</Link>
      </div>
    </div>
  );
}
