# Mobile Builds

## Option A: PWA (already enabled)
1. Run production build and deploy.
2. Open app in mobile browser.
3. Use "Add to Home Screen".
4. App runs in standalone mode using `public/manifest.json`.

## Option B: Capacitor (iOS + Android)

Install dependencies:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

Initialize Capacitor:

```bash
npx cap init NotesApp com.example.notesapp --web-dir=.next
```

Build web app and sync native projects:

```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

Open native IDE projects:

```bash
npx cap open android
npx cap open ios
```

Notes:
- For Capacitor releases, point API/auth redirects to a deployed HTTPS URL.
- Update Supabase Auth Redirect URLs for any mobile deep-link or hosted callback strategy you use.
