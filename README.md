# Parea
App for friendgroups

## Setup

Requirements: Node.js 20+ and npm. For phones, install the **Expo Go** app.

```bash
npm ci
```

Create a `.env` file (copy `.env.example`) and fill in the Supabase values from
Supabase Dashboard → Project Settings → API:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The database schema lives in `supabase/schema.sql`.

## Run

```bash
npm start        # Expo dev server — scan the QR code with Expo Go
npm run web      # run in the browser
npm run android  # Android emulator / device
npm run ios      # iOS simulator (macOS only)
```
