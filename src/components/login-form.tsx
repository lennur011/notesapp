'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function LoginForm() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signInWithEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Signed in');
    window.location.href = '/';
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    });

    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-xl backdrop-blur">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to access your private notes.</p>

      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
      >
        Sign in with Google
      </button>

      <div className="my-5 text-center text-xs uppercase tracking-wider text-muted">Or</div>

      <form onSubmit={signInWithEmail} className="space-y-3">
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
