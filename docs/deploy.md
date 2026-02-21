# Deployment (Vercel + Supabase)

## Vercel
1. Push project to GitHub.
2. Import repository in Vercel.
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL (or custom domain)
4. Deploy.

## Supabase post-deploy checks
1. Auth -> URL Configuration:
   - Site URL = deployed app URL.
   - Redirect URLs includes `<deployed-url>/auth/callback`.
2. Google provider remains enabled and callback URI stays:
   - `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
3. Storage bucket `note-images` exists and policies are active.
