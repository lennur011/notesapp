import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NotesClient from '@/components/notes-client';
import type { Note } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return <NotesClient initialNotes={(notes ?? []) as Note[]} />;
}
