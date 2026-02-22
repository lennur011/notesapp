# Mobile Builds

## Option A: Expo (recommended for fast testing)

The repo now includes an Expo app in `expo-app/` with:
- Expo SDK 54
- Email/password sign up and sign in
- Google sign up/sign in
- Session persistence
- Notes list/create/update/delete via Supabase

Steps:

```bash
cd expo-app
npm install
copy .env.example .env
```

Set `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
```

Run on phone with Expo Go:

```bash
npm start
```

Then scan the QR code.

Google OAuth setup for Expo:
1. Supabase -> Authentication -> URL Configuration -> Redirect URLs:
   - `exp://**/--/auth/callback`
   - `notesapp://auth/callback`
2. Supabase -> Authentication -> Providers -> Google:
   - Enable provider
   - Use callback URI:
     `https://<PROJECT-REF>.supabase.co/auth/v1/callback`

## Option B: PWA
1. Run production build and deploy.
2. Open app in mobile browser.
3. Use "Add to Home Screen".
4. App runs in standalone mode using `public/manifest.json`.
