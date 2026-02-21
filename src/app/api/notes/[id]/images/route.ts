import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: note } = await supabase
    .from('notes')
    .select('id,image_urls')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('note-images').upload(path, file, {
      upsert: false,
      contentType: file.type
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    uploadedPaths.push(path);
  }

  const allPaths = [...(note.image_urls ?? []), ...uploadedPaths];

  const { data: updated, error: updateError } = await supabase
    .from('notes')
    .update({ image_urls: allPaths, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('image_urls')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const signedUrls = await Promise.all(
    (updated.image_urls ?? []).map(async (path: string) => {
      const { data } = await supabase.storage.from('note-images').createSignedUrl(path, 60 * 60);
      return data?.signedUrl;
    })
  );

  return NextResponse.json({ image_paths: updated.image_urls ?? [], image_urls: signedUrls.filter(Boolean) });
}
