'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { decryptNoteContent, encryptNoteContent, isEncryptedContent } from '@/lib/encryption';
import type { Note } from '@/lib/types';
import { Grid2X2, List, Lock, Search, Plus, ArrowUpDown, Trash2, ImagePlus, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';

const sortOptions = [
  { label: 'Updated (newest)', value: 'updated_desc' },
  { label: 'Updated (oldest)', value: 'updated_asc' },
  { label: 'Created (newest)', value: 'created_desc' },
  { label: 'Created (oldest)', value: 'created_asc' }
] as const;

type Props = {
  initialNotes: Note[];
};

export default function NotesClient({ initialNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]['value']>('updated_desc');
  const [protect, setProtect] = useState(false);
  const [notePassword, setNotePassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const supabase = createClient();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkTheme = resolvedTheme === 'dark';
  const canEditBody = !selected?.is_password_protected || isUnlocked;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialNotes.length) {
      chooseNote(initialNotes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editorRef.current || !canEditBody) {
      return;
    }

    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || '';
    }
  }, [content, canEditBody]);

  const filtered = useMemo(() => {
    const list = notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const createdA = new Date(a.created_at).getTime();
      const createdB = new Date(b.created_at).getTime();
      const updatedA = new Date(a.updated_at).getTime();
      const updatedB = new Date(b.updated_at).getTime();

      if (sortBy === 'created_desc') return createdB - createdA;
      if (sortBy === 'created_asc') return createdA - createdB;
      if (sortBy === 'updated_asc') return updatedA - updatedB;
      return updatedB - updatedA;
    });
  }, [notes, search, sortBy]);

  const hydrateContentImages = (html: string, paths: string[], signedUrls: string[]) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const pathToUrl = new Map(paths.map((path, index) => [path, signedUrls[index] ?? '']));

    wrapper.querySelectorAll('img[data-note-path]').forEach((img) => {
      const path = img.getAttribute('data-note-path');
      if (!path) return;
      const signedUrl = pathToUrl.get(path);
      if (signedUrl) {
        img.setAttribute('src', signedUrl);
      }
    });

    return wrapper.innerHTML;
  };

  const resolveSignedUrls = async (paths: string[]) => {
    if (!paths.length) {
      setImageUrls([]);
      return;
    }

    const signed = await Promise.all(
      paths.map(async (path) => {
        const { data } = await supabase.storage.from('note-images').createSignedUrl(path, 60 * 60);
        return data?.signedUrl ?? '';
      })
    );

    setImageUrls(signed.filter(Boolean));
    if (content) {
      const refreshed = hydrateContentImages(content, paths, signed);
      if (refreshed !== content) {
        setContent(refreshed);
      }
    }
  };

  const applyFormat = (command: string, value?: string) => {
    if (!canEditBody || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setContent(editorRef.current.innerHTML);
  };

  const resetEditor = () => {
    setSelected(null);
    setTitle('');
    setContent('');
    setProtect(false);
    setNotePassword('');
    setUnlockPassword('');
    setIsUnlocked(true);
    setImagePaths([]);
    setImageUrls([]);
  };

  const chooseNote = (note: Note) => {
    setSelected(note);
    setTitle(note.title);
    setProtect(note.is_password_protected);
    setImagePaths(note.image_urls ?? []);
    setUnlockPassword('');
    resolveSignedUrls(note.image_urls ?? []);

    if (!note.is_password_protected) {
      setContent(note.content);
      setIsUnlocked(true);
    } else {
      setContent('');
      setIsUnlocked(false);
    }
  };

  const unlockNote = () => {
    if (!selected) return;
    try {
      if (!selected.is_password_protected) {
        setContent(selected.content);
        setIsUnlocked(true);
        return;
      }

      if (!isEncryptedContent(selected.content)) {
        toast.error('Note payload is invalid');
        return;
      }

      const decrypted = decryptNoteContent(selected.content, unlockPassword);
      setContent(decrypted);
      setIsUnlocked(true);
      toast.success('Note unlocked');
    } catch {
      toast.error('Incorrect password');
    }
  };

  const saveNote = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (protect && !notePassword && !selected?.is_password_protected) {
      toast.error('Set a password for protected note');
      return;
    }

    let payloadContent = content;
    if (protect) {
      const pass = notePassword || unlockPassword;
      if (!pass) {
        toast.error('Password required to encrypt');
        return;
      }
      payloadContent = encryptNoteContent(content, pass);
    }

    const body = {
      title,
      content: payloadContent,
      is_password_protected: protect,
      image_urls: imagePaths
    };

    const endpoint = selected ? `/api/notes/${selected.id}` : '/api/notes';
    const method = selected ? 'PATCH' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      toast.error('Failed to save note');
      return;
    }

    const note = (await response.json()) as Note;
    const updated = selected
      ? notes.map((n) => (n.id === note.id ? note : n))
      : [note, ...notes];

    setNotes(updated);
    chooseNote(note);
    toast.success(selected ? 'Note updated' : 'Note created');
  };

  const deleteNote = async () => {
    if (!selected) return;

    const response = await fetch(`/api/notes/${selected.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Failed to delete note');
      return;
    }

    setNotes((prev) => prev.filter((n) => n.id !== selected.id));
    resetEditor();
    toast.success('Note deleted');
  };

  const uploadImages = async (files: FileList | null) => {
    if (!selected || !files?.length) {
      toast.error('Create note first, then upload images');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch(`/api/notes/${selected.id}/images`, {
      method: 'POST',
      body: formData
    });

    setUploading(false);

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(errorPayload?.error ?? 'Upload failed');
      return;
    }

    const data = (await response.json()) as { image_paths: string[]; image_urls: string[] };
    setImagePaths(data.image_paths);
    setImageUrls(data.image_urls);

    const newPaths = data.image_paths.filter((path) => !imagePaths.includes(path));
    if (newPaths.length) {
      const snippets = newPaths
        .map((path, index) => {
          const signedUrl = data.image_urls[data.image_paths.indexOf(path)] ?? '';
          return signedUrl
            ? `<p><img src="${signedUrl}" data-note-path="${path}" alt="Attached image" /></p>`
            : '';
        })
        .filter(Boolean)
        .join('');

      if (snippets) {
        setContent((prev) => `${prev}${snippets}`);
      }
    }

    const updatedNote = { ...selected, image_urls: data.image_paths };
    setSelected(updatedNote);
    setNotes((prev) => prev.map((n) => (n.id === selected.id ? updatedNote : n)));

    toast.success('Images uploaded');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="app-shell">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-r border-border/70 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">My Notes</h1>
            <button onClick={resetEditor} className="rounded-full bg-accent p-2 text-white">
              <Plus size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search size={16} className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <ArrowUpDown size={15} className="text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as (typeof sortOptions)[number]['value'])}
              className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setLayout('list')}
              className={`rounded-lg border px-3 py-1.5 text-sm ${layout === 'list' ? 'bg-accent text-white' : 'border-border'}`}
            >
              <span className="inline-flex items-center gap-1"><List size={14} />List</span>
            </button>
            <button
              onClick={() => setLayout('grid')}
              className={`rounded-lg border px-3 py-1.5 text-sm ${layout === 'grid' ? 'bg-accent text-white' : 'border-border'}`}
            >
              <span className="inline-flex items-center gap-1"><Grid2X2 size={14} />Grid</span>
            </button>
          </div>

          <div className={`mt-4 grid gap-3 ${layout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {filtered.map((note) => (
              <motion.button
                key={note.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => chooseNote(note)}
                className={`note-card p-3 text-left ${selected?.id === note.id ? 'ring-2 ring-accent' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-medium">{note.title}</h3>
                  {note.is_password_protected ? <Lock size={14} className="text-muted" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted">Updated {new Date(note.updated_at).toLocaleString()}</p>
              </motion.button>
            ))}
          </div>

          <div className="mt-6 hidden items-center gap-2 md:flex">
            <button
              onClick={() => {
                if (!mounted) return;
                setTheme(isDarkTheme ? 'light' : 'dark');
              }}
              className="rounded-lg border border-border p-2"
              aria-label="Toggle theme"
            >
              {mounted && isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </aside>

        <section className="p-4 pb-24 md:p-8 md:pb-8">
          <div className="note-card p-4 md:p-6">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="w-full border-b border-border bg-transparent pb-3 text-xl font-semibold outline-none"
            />

            {selected?.is_password_protected && !isUnlocked ? (
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted">This note is encrypted. Enter password to unlock.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    type="password"
                    placeholder="Password"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <button onClick={unlockNote} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => applyFormat('bold')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Bold
                  </button>
                  <button type="button" onClick={() => applyFormat('italic')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Italic
                  </button>
                  <button type="button" onClick={() => applyFormat('underline')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Underline
                  </button>
                  <button type="button" onClick={() => applyFormat('insertUnorderedList')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Bullet list
                  </button>
                  <button type="button" onClick={() => applyFormat('formatBlock', '<h2>')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Heading
                  </button>
                  <button type="button" onClick={() => applyFormat('removeFormat')} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold">
                    Clear
                  </button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setContent((e.currentTarget as HTMLDivElement).innerHTML)}
                  className="mt-3 min-h-[22rem] w-full rounded-xl border border-border bg-card p-3 text-sm outline-none"
                />
                {!content ? <p className="mt-2 text-xs text-muted">Start writing your note...</p> : null}
              </>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
                Password protect
              </label>
              {protect ? (
                <input
                  type="password"
                  value={notePassword}
                  onChange={(e) => setNotePassword(e.target.value)}
                  placeholder={selected?.is_password_protected ? 'New password (optional)' : 'Set password'}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              ) : null}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <ImagePlus size={15} />
                Upload images
                <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => uploadImages(e.target.files)} />
              </label>

              <button onClick={saveNote} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
                {selected ? 'Update note' : 'Create note'}
              </button>

              {selected ? (
                <button onClick={deleteNote} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600">
                  <Trash2 size={14} /> Delete
                </button>
              ) : null}
            </div>

            {uploading ? <p className="mt-2 text-xs text-muted">Uploading images...</p> : null}

            {imageUrls.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {imageUrls.map((url) => (
                  <img key={url} src={url} alt="Note attachment" className="h-28 w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => {
              if (!mounted) return;
              setTheme(isDarkTheme ? 'light' : 'dark');
            }}
            className="rounded-lg border border-border p-2"
            aria-label="Toggle theme"
          >
            {mounted && isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={resetEditor} className="rounded-lg bg-accent px-4 py-2 text-sm text-white">
            New note
          </button>
          <button onClick={logout} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </nav>
    </div>
  );
}
