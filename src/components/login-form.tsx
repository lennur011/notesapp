'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginForm() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Signed in');
      window.location.href = '/';
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.session) {
      toast.success('Account created');
      window.location.href = '/';
      return;
    }

    toast.success('Account created. Check your email to confirm sign up.');
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-xl backdrop-blur">
      <h1 className="text-2xl font-semibold">
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === 'signin'
          ? 'Sign in to access your private notes.'
          : 'Sign up to start creating private notes.'}
      </p>

      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-fg transition hover:bg-bg"
      >
        Continue with Google
      </button>

      <div className="my-5 text-center text-xs uppercase tracking-wider text-muted">Or</div>

      <form onSubmit={handleEmailAuth} className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          placeholder="Password"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="mt-4 w-full text-center text-sm text-muted transition hover:text-foreground"
      >
        {mode === 'signin'
          ? "Don't have an account? Sign up"
          : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}
