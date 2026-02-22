# Setup Guide

## 1) Install dependencies

```bash
npm install
```

## 2) Supabase project
1. Create a new Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Auth -> Providers:
   - Enable Email provider.
   - Enable Google provider.

## 3) Google OAuth config
1. In Google Cloud Console, create OAuth client credentials (Web).
2. Add Authorized redirect URI:
   - `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
3. Copy client ID + secret into Supabase Auth Google provider settings.
4. In Supabase Auth URL settings:
   - Set Site URL: `http://localhost:3000` (local)
   - Add Redirect URL: `http://localhost:3000/auth/callback`
   - Add your deployed URL callback too: `https://<your-domain>/auth/callback`

## 4) Environment variables
Copy `.env.example` to `.env.local` and fill values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
```

## 5) Run

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 6) Signup + sign-in behavior
- `/login` now supports both sign in and sign up with email/password.
- "Continue with Google" supports both new account signup and returning users.
- New users may need email confirmation if enabled in Supabase Auth settings.
