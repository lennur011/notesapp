import { createClient } from '@/lib/supabase/server';
import LoginForm from '@/components/login-form';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
