# Expo App (SDK 54)

This mobile app is configured for Expo SDK 54.

## Prerequisites
- Expo Go app on your phone (SDK 54 compatible build)
- Node.js 18+

## Run

```bash
cd expo-app
npm install
copy .env.example .env
```

Set `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
EXPO_PUBLIC_AUTH_REDIRECT_URL=exp://<YOUR-LAN-IP>:8081/--/auth/callback
```

Start:

```bash
npm start
```

## Google sign in / sign up (Supabase)

The app uses `Linking.createURL('auth/callback')` for OAuth callbacks.
If you keep getting redirected to `localhost:3000`, set `EXPO_PUBLIC_AUTH_REDIRECT_URL` explicitly.

In Supabase Dashboard -> Authentication -> URL Configuration, add Redirect URLs:

- `exp://**/--/auth/callback` (Expo Go)
- `notesapp://auth/callback` (native builds)

In Supabase Dashboard -> Authentication -> Providers -> Google:
- Enable Google
- Use callback URL:
  `https://<PROJECT-REF>.supabase.co/auth/v1/callback`

If dependencies drift, run:

```bash
npx expo install --fix
```
