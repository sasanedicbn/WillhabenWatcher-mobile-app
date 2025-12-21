# Willhaben Cars - Upute za Instalaciju na Telefon

## Opcija 1: Instalacija putem Expo Go (Testiranje)

1. Skini **Expo Go** app iz Play Store / App Store
2. Skeniraj QR kod iz Replit URL trake
3. Aplikacija se otvori u Expo Go

**Nedostatak**: Treba svaki put skenirati QR kod

---

## Opcija 2: Pravi APK (Android) - PREPORUČENO

Za pravu instalaciju koja ostaje na telefonu, trebamo napraviti APK build.

### Koraci:

#### 1. Instaliraj EAS CLI (na računalu)
```bash
npm install -g eas-cli
```

#### 2. Prijavi se na Expo
```bash
eas login
# Napravi račun na expo.dev ako ga nemaš
```

#### 3. Konfiguriši EAS Build
```bash
eas build:configure
```

#### 4. Napravi APK za Android
```bash
eas build --platform android --profile preview
```

Ovo će:
- Napraviti APK koji možeš skinuti
- Build traje 10-15 minuta
- Dobiješ link za download APK-a

#### 5. Instaliraj na telefon
- Skini APK na Android telefon
- Otvori ga i instaliraj (dozvoli "Unknown sources")
- Aplikacija ostaje instalirana trajno!

---

## Konfiguracija za Production Build

Ako želiš objaviti na Play Store, dodaj u `eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

---

## Ažuriranje API URL-a za Production

Prije builda, ažuriraj `services/api.ts`:

```typescript
// Dodaj na početak datoteke:
const PRODUCTION_API_URL = 'https://your-hetzner-server.com';

// Ili IP adresa:
const PRODUCTION_API_URL = 'http://YOUR_VPS_IP:8082';

// Ažuriraj getBaseUrl() da koristi PRODUCTION_API_URL u production buildu
```

---

## Push Notifikacije - OBAVEZNO!

Za push notifikacije MORAŠ napraviti EAS projekt:

### Koraci:

1. Idi na [expo.dev](https://expo.dev) i napravi račun
2. Instaliraj EAS CLI: `npm install -g eas-cli`
3. Prijavi se: `eas login`
4. Konfiguriši projekt: `eas build:configure`
5. Expo će automatski generirati **Project ID**
6. Ažuriraj `app.json` - zamijeni `YOUR_EAS_PROJECT_ID` s pravim ID-om:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "abc123-your-real-project-id"
      }
    }
  }
}
```

**VAŽNO**: Bez pravog EAS Project ID-a, push notifikacije NEĆE raditi!

---

## iOS (iPhone)

Za iOS build trebaš:
- Apple Developer Account ($99/godišnje)
- Mac računalo za generiranje certifikata

Za osobnu upotrebu, Android APK je besplatan i jednostavniji.

---

## Sažetak

| Metoda | Cijena | Složenost | Trajnost |
|--------|--------|-----------|----------|
| Expo Go | Besplatno | Lako | Treba QR svaki put |
| Android APK | Besplatno | Srednje | Trajna instalacija |
| Play Store | $25 (jednom) | Složeno | Automatska ažuriranja |
| iOS TestFlight | $99/god | Složeno | 90 dana |
