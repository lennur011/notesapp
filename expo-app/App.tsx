import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import type { Session } from '@supabase/supabase-js';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { supabase } from './src/lib/supabase';
import { decryptNoteContent, encryptNoteContent, isEncryptedContent } from './src/lib/encryption';
import type { Note } from './src/types';

WebBrowser.maybeCompleteAuthSession();

function getOAuthParams(url: string) {
  const [base, hash = ''] = url.split('#');
  const queryString = base.includes('?') ? base.split('?')[1] : '';
  const params = new URLSearchParams(queryString);
  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

function getFileExt(uri: string) {
  const name = uri.split('?')[0] ?? '';
  const ext = name.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : 'jpg';
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hydrateHtmlImages(html: string, paths: string[], signedUrls: string[]) {
  let next = html;
  paths.forEach((path, index) => {
    const url = signedUrls[index];
    if (!url) return;
    const escapedPath = escapeRegExp(path);
    const pattern = new RegExp(
      `(<img[^>]*data-note-path=["']${escapedPath}["'][^>]*src=["'])[^"']*(["'][^>]*>)`,
      'g'
    );
    next = next.replace(pattern, `$1${url}$2`);
  });
  return next;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session ?? null);
        setAuthLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.screenCenter} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View pointerEvents="none" style={[styles.mistOrb, styles.mistOrbTop]} />
        <View pointerEvents="none" style={[styles.mistOrb, styles.mistOrbBottom]} />
        {session ? <NotesScreen userId={session.user.id} /> : <AuthScreen />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setMessage(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setMessage(error.message);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data.session) {
      setMessage('Account created. Check your email to confirm your account.');
      return;
    }

    setMessage('Account created and signed in.');
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setMessage(null);

    const redirectTo =
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error || !data?.url) {
      setLoading(false);
      setMessage(error?.message ?? `Could not start Google sign-in. Redirect URL: ${redirectTo}`);
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      setLoading(false);
      setMessage(result.type === 'cancel' ? 'Google sign-in canceled.' : 'Google sign-in failed.');
      return;
    }

    const params = getOAuthParams(result.url);
    const code = params.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      setLoading(false);
      if (exchangeError) setMessage(exchangeError.message);
      return;
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setLoading(false);
      setMessage('Missing auth tokens from Google redirect.');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    setLoading(false);
    if (sessionError) setMessage(sessionError.message);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.centerWrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}
    >
      <View style={styles.card}>
        <Text style={styles.heading}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#b7bec9"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#b7bec9"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.primaryButton} onPress={submit} disabled={loading}>
          <Text style={styles.primaryButtonText}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Text>
        </Pressable>
        <Pressable style={styles.googleButton} onPress={signInWithGoogle} disabled={loading}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text style={styles.switchText}>
            {mode === 'signin' ? 'No account? Sign up' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function NotesScreen({ userId }: { userId: string }) {
  const insets = useSafeAreaInsets();
  const richRef = useRef<RichEditor | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [protect, setProtect] = useState(false);
  const [notePassword, setNotePassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState<'list' | 'editor'>('list');
  const [uploading, setUploading] = useState(false);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const canEdit = !selected?.is_password_protected || isUnlocked;

  const resolveSignedUrls = async (paths: string[], sourceHtml?: string) => {
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
    const hydrated = hydrateHtmlImages(sourceHtml ?? content, paths, signed);
    if (hydrated !== (sourceHtml ?? content)) {
      setContent(hydrated);
      richRef.current?.setContentHTML(hydrated);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotes(data ?? []);
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startNew = () => {
    setSelectedId(null);
    setTitle('');
    setContent('');
    setProtect(false);
    setNotePassword('');
    setUnlockPassword('');
    setIsUnlocked(true);
    setImagePaths([]);
    setImageUrls([]);
    setMessage(null);
    setScreen('editor');
  };

  const closeEditor = () => {
    setScreen('list');
    setMessage(null);
  };

  const selectNote = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title);
    setProtect(note.is_password_protected);
    setNotePassword('');
    setUnlockPassword('');
    setImagePaths(note.image_urls ?? []);
    setMessage(null);

    if (note.is_password_protected) {
      setContent('');
      setIsUnlocked(false);
      setImageUrls([]);
    } else {
      setContent(note.content);
      setIsUnlocked(true);
      resolveSignedUrls(note.image_urls ?? [], note.content);
    }

    setScreen('editor');
  };

  const unlockNote = async () => {
    if (!selected) return;
    try {
      if (!selected.is_password_protected) {
        setContent(selected.content);
        setIsUnlocked(true);
        return;
      }

      if (!isEncryptedContent(selected.content)) {
        setMessage('Note payload is invalid.');
        return;
      }

      const decrypted = decryptNoteContent(selected.content, unlockPassword);
      setContent(decrypted);
      setIsUnlocked(true);
      await resolveSignedUrls(selected.image_urls ?? [], decrypted);
      setMessage('Note unlocked.');
    } catch {
      setMessage('Incorrect password.');
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setMessage('Title is required.');
      return;
    }

    if (!canEdit) {
      setMessage('Unlock this note first.');
      return;
    }

    if (protect && !notePassword && !selected?.is_password_protected) {
      setMessage('Set a password for this note.');
      return;
    }

    let payloadContent = content;
    if (protect) {
      const pass = notePassword || unlockPassword;
      if (!pass) {
        setMessage('Password required to encrypt.');
        return;
      }
      payloadContent = encryptNoteContent(content, pass);
    }

    setSaving(true);
    setMessage(null);

    if (selected) {
      const { data, error } = await supabase
        .from('notes')
        .update({ title, content: payloadContent, is_password_protected: protect })
        .eq('id', selected.id)
        .select()
        .single();

      setSaving(false);
      if (error) {
        setMessage(error.message);
        return;
      }

      setNotes((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
      setSelectedId(data.id);
      setMessage('Note updated.');
      return;
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        title,
        content: payloadContent,
        user_id: userId,
        is_password_protected: protect,
        image_urls: []
      })
      .select()
      .single();

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setNotes((prev) => [data, ...prev]);
    setSelectedId(data.id);
    setImagePaths([]);
    setImageUrls([]);
    if (protect) {
      setUnlockPassword(notePassword);
    }
    setMessage('Note created. You can now add images.');
  };

  const remove = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from('notes').delete().eq('id', selected.id);
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotes((prev) => prev.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    setTitle('');
    setContent('');
    setProtect(false);
    setNotePassword('');
    setUnlockPassword('');
    setIsUnlocked(true);
    setImagePaths([]);
    setImageUrls([]);
    setScreen('list');
    setMessage('Note deleted.');
  };

  const addImages = async () => {
    if (!selectedId) {
      setMessage('Save the note first, then add images.');
      return;
    }
    if (!canEdit) {
      setMessage('Unlock this note first.');
      return;
    }

    const pickResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85
    });

    if (pickResult.canceled || !pickResult.assets.length) {
      return;
    }

    setUploading(true);
    setMessage(null);

    const newPaths: string[] = [];
    const failedUploads: string[] = [];
    for (let i = 0; i < pickResult.assets.length; i += 1) {
      const asset = pickResult.assets[i];
      const ext = getFileExt(asset.uri);
      const path = `${userId}/${selectedId}/${Date.now()}-${i}.${ext}`;
      const fileName = asset.fileName ?? `image-${Date.now()}-${i}.${ext}`;
      const file = {
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType ?? 'image/jpeg'
      };
      const { error } = await supabase.storage
        .from('note-images')
        .upload(path, file as never, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });

      if (!error) {
        newPaths.push(path);
      } else {
        failedUploads.push(error.message);
      }
    }

    if (!newPaths.length) {
      setUploading(false);
      setMessage(failedUploads[0] ?? 'Image upload failed.');
      return;
    }

    const updatedPaths = [...imagePaths, ...newPaths];
    const { data, error } = await supabase
      .from('notes')
      .update({ image_urls: updatedPaths })
      .eq('id', selectedId)
      .select()
      .single();

    setUploading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setImagePaths(updatedPaths);
    const signed = await Promise.all(
      updatedPaths.map(async (path) => {
        const { data: signedData } = await supabase.storage.from('note-images').createSignedUrl(path, 60 * 60);
        return signedData?.signedUrl ?? '';
      })
    );
    setImageUrls(signed.filter(Boolean));

    const inserts = newPaths
      .map((path) => {
        const url = signed[updatedPaths.indexOf(path)] ?? '';
        if (!url) return '';
        return `<p><img src="${url}" data-note-path="${path}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
      })
      .filter(Boolean)
      .join('');

    if (inserts) {
      const next = `${content}${inserts}`;
      setContent(next);
      richRef.current?.insertHTML(inserts);
    }

    setNotes((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
    setMessage(
      failedUploads.length
        ? `Added ${newPaths.length} image(s). ${failedUploads.length} failed.`
        : 'Images added.'
    );
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (screen === 'editor') {
    return (
      <View style={[styles.notesWrap, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.editorCard}>
          <View style={styles.headerRow}>
            <Text style={styles.editorTitle}>{selected ? 'Edit note' : 'New note'}</Text>
            <Pressable style={styles.secondaryButton} onPress={closeEditor}>
              <Text style={styles.secondaryButtonText}>Back to list</Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Title"
            placeholderTextColor="#b7bec9"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />

          {selected?.is_password_protected && !isUnlocked ? (
            <View style={styles.unlockCard}>
              <Text style={styles.message}>This note is encrypted. Enter password to unlock.</Text>
              <View style={styles.row}>
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#b7bec9"
                  secureTextEntry
                  value={unlockPassword}
                  onChangeText={setUnlockPassword}
                  style={[styles.input, styles.passwordInput]}
                />
                <Pressable style={styles.primaryButton} onPress={unlockNote}>
                  <Text style={styles.primaryButtonText}>Unlock</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.message}>Password protect</Text>
                <Switch value={protect} onValueChange={setProtect} />
              </View>
              {protect ? (
                <TextInput
                  placeholder={selected?.is_password_protected ? 'New password (optional)' : 'Set password'}
                  placeholderTextColor="#b7bec9"
                  secureTextEntry
                  value={notePassword}
                  onChangeText={setNotePassword}
                  style={styles.input}
                />
              ) : null}

              <RichToolbar
                editor={richRef}
                actions={[actions.setBold, actions.setItalic, actions.setUnderline, actions.insertBulletsList]}
                style={styles.richToolbar}
                iconTint="#e8ecf2"
                selectedIconTint="#ffffff"
                selectedButtonStyle={styles.richToolbarSelected}
              />
              <RichEditor
                ref={richRef}
                key={`editor-${selectedId ?? 'new'}-${isUnlocked ? 'u' : 'l'}`}
                initialContentHTML={content}
                editorStyle={{
                  backgroundColor: 'transparent',
                  color: '#f3f5f8',
                  placeholderColor: '#b7bec9',
                  contentCSSText: 'font-size: 16px; min-height: 220px; color: #f3f5f8;'
                }}
                style={styles.richEditor}
                placeholder="Write your note..."
                onChange={(html) => setContent(html)}
              />
            </>
          )}

          <View style={styles.row}>
            <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
              <Text style={styles.primaryButtonText}>
                {saving ? 'Saving...' : selected ? 'Update note' : 'Create note'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, !selectedId ? styles.disabledButton : null]}
              onPress={addImages}
              disabled={!selectedId || uploading}
            >
              <Text style={styles.secondaryButtonText}>{uploading ? 'Uploading...' : 'Add image'}</Text>
            </Pressable>
            <Pressable
              style={[styles.dangerButton, !selected ? styles.disabledButton : null]}
              onPress={remove}
              disabled={!selected || saving}
            >
              <Text style={styles.primaryButtonText}>Delete</Text>
            </Pressable>
          </View>

          {imageUrls.length ? (
            <FlatList
              data={imageUrls}
              horizontal
              keyExtractor={(item) => item}
              contentContainerStyle={styles.imageRow}
              renderItem={({ item }) => <Image source={{ uri: item }} style={styles.imageThumb} />}
              showsHorizontalScrollIndicator={false}
            />
          ) : null}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.notesWrap, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Notes</Text>
        <Pressable style={styles.secondaryButton} onPress={logout}>
          <Text style={styles.secondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listColumn}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.noteRow, selectedId === item.id ? styles.noteChipActive : null]}
              onPress={() => selectNote(item)}
            >
              <Text numberOfLines={1} style={styles.noteChipText}>
                {item.is_password_protected ? '🔒 ' : ''}
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.noteMetaText}>
                {new Date(item.updated_at).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.message}>No notes yet. Tap + to add a note.</Text>}
        />
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={startNew}
        accessibilityLabel="Add new note"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1217'
  },
  screenCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1217'
  },
  mistOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(192, 201, 216, 0.12)'
  },
  mistOrbTop: {
    top: -80,
    left: -40
  },
  mistOrbBottom: {
    right: -70,
    bottom: 120,
    backgroundColor: 'rgba(129, 141, 159, 0.11)'
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  notesWrap: {
    flex: 1,
    paddingHorizontal: 16
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    padding: 16,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  editorCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10
  },
  unlockCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)'
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f3f5f8'
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f3f5f8'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#f3f5f8'
  },
  passwordInput: {
    flex: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  listColumn: {
    gap: 8,
    paddingBottom: 12
  },
  noteRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  noteChipActive: {
    borderColor: 'rgba(255, 255, 255, 0.52)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)'
  },
  noteChipText: {
    fontSize: 14,
    color: '#f3f5f8',
    fontWeight: '600'
  },
  noteMetaText: {
    marginTop: 2,
    fontSize: 12,
    color: '#c5ccd7'
  },
  primaryButton: {
    backgroundColor: '#1d2229',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)'
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  dangerButton: {
    backgroundColor: 'rgba(180, 53, 53, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  disabledButton: {
    opacity: 0.5
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  secondaryButtonText: {
    color: '#f3f5f8',
    fontWeight: '600'
  },
  googleButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  googleButtonText: {
    color: '#f3f5f8',
    fontWeight: '600',
    textAlign: 'center'
  },
  switchText: {
    color: '#d5dbe5',
    fontSize: 14,
    fontWeight: '500'
  },
  richToolbar: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  richToolbarSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)'
  },
  richEditor: {
    minHeight: 230,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden'
  },
  imageRow: {
    gap: 8,
    paddingTop: 4
  },
  imageThumb: {
    width: 96,
    height: 96,
    borderRadius: 12
  },
  message: {
    color: '#d5dbe5',
    fontSize: 13,
    marginTop: 8
  },
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d2229',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9
  },
  fabText: {
    color: '#ffffff',
    fontSize: 32,
    lineHeight: 34,
    marginTop: -2
  }
});
