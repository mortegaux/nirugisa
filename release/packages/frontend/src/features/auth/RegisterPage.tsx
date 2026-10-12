import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { invitationApi } from '@/services/api';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationValid, setInvitationValid] = useState(false);
  const navigate = useNavigate();
  const registerWithInvite = useAuthStore((state) => state.registerWithInvite);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid invitation link. Missing token.');
        setLoading(false);
        return;
      }

      try {
        const response = await invitationApi.validate(token);
        setInvitationEmail(response.data.email);
        setInvitationValid(true);
      } catch (err: any) {
        setError('Invalid or expired invitation link.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await registerWithInvite(token!, username, password);
      navigate('/recipes');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-2 text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitationValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-lg border border-border text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg className="h-6 w-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-card-foreground mb-2">Invalid Invitation</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-lg bg-card p-8 shadow-lg border border-border">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-primary mb-2">Nommable</h1>
          <p className="text-muted-foreground">Complete Your Registration</p>
        </div>

        <div className="mb-6 rounded-lg bg-secondary/10 border border-secondary/20 p-3">
          <p className="text-sm text-card-foreground">
            <span className="font-medium">Email:</span> {invitationEmail}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-card-foreground mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Choose a username"
              required
              minLength={3}
              autoComplete="username"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 3 characters</p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-card-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Create a password"
              required
              minLength={6}
              autoComplete="new-password"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-card-foreground mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              aria-required="true"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 text-primary-foreground font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
