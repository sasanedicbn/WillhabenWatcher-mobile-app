# Willhaben Cars - React Native Expo App

## Overview
A React Native Expo mobile application for real-time browsing of car listings from Willhaben (Austria). Features live scraping every 30 seconds, push notifications for new vehicles, and smart phone calling integration.

## Current State
- **Version**: 1.1.0
- **Last Updated**: December 21, 2025
- **Status**: Production Ready (Push Notifications + Hetzner Deployment)

## Features
1. **Live Vehicle Scraping**
   - Backend scrapes Willhaben every 30 seconds
   - Shows vehicles up to €10,000 from private sellers
   - In-memory storage (no database - intentional design)

2. **Vehicle List Screen**
   - Scrollable list of vehicle cards sorted by newest
   - Each card shows: image, title, year, mileage, price
   - New vehicle indicator badge
   - Message and chat action icons

3. **Smart "Potraži broj" Button**
   - Radio mode ON + has phone: Green button, phone icon, direct call
   - Radio mode OFF or no phone: Purple button, opens DasSchnelle.at

4. **Navigation Bar**
   - "Logout" button (displays alert - no auth)
   - Headphone icon for phone calls
   - Radio toggle to enable/disable call mode

5. **Push Notifications**
   - Notifications when new vehicles are found
   - Works even when app is closed (requires EAS build)

6. **Card Interactions**
   - Tap image: Opens Google search for vehicle + location + "kontakt"
   - Tap card body: Navigates to Details screen
   - Tap message/chat icons: Opens Willhaben app or web fallback

## Project Architecture

### File Structure
```
/
├── App.tsx                     # Root component with providers
├── app.json                    # Expo configuration
├── EAS_BUILD_GUIDE.md          # Guide for building APK
├── components/
│   ├── VehicleCard.tsx         # Main vehicle card component
│   ├── SimilarVehicleCard.tsx  # Mini card for similar vehicles
│   ├── HeaderTitle.tsx         # Custom header with app icon
│   └── ErrorBoundary.tsx       # Error handling wrapper
├── context/
│   ├── RadioModeContext.tsx    # Phone call mode state
│   ├── PhoneContext.tsx        # Current phone number state
│   └── NotificationContext.tsx # Push notification registration
├── server/
│   ├── index.js                # Express API + push notifications
│   ├── scraper.js              # Willhaben scraper
│   ├── Dockerfile              # Docker config for deployment
│   ├── docker-compose.yml      # Docker Compose config
│   ├── DEPLOYMENT.md           # Hetzner deployment guide
│   └── package.json            # Server dependencies
├── services/
│   └── api.ts                  # API client with production URL support
├── screens/
│   ├── HomeScreen.tsx          # Vehicle list
│   └── DetailsScreen.tsx       # Vehicle details
└── constants/
    └── theme.ts                # Colors, spacing, typography
```

### API Endpoints (Server)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vehicles` | GET | Get all vehicles (max 100) |
| `/api/vehicles/new` | GET | Get newly found vehicles |
| `/api/vehicles/mark-seen` | POST | Mark vehicles as seen |
| `/api/scrape` | POST | Trigger manual scrape |
| `/api/health` | GET | Health check |
| `/api/register-push-token` | POST | Register device for push notifications |

### State Management
- React Context for radio mode, phone number, and notifications
- In-memory Map/Set on server for vehicle storage
- No external database - by design

### Styling
- Primary color: #1E40AF (deep blue)
- Success color: #22C55E (green for radio mode)
- Purple: #7C3AED (DasSchnelle.at button)

## User Preferences
- Language: Croatian/Serbian for UI, German for phone-related features
- No authentication required (personal use app)
- Austrian locale formatting (EUR currency)

## Deployment

### Option 1: Replit (Current)
- App runs via `npm run dev`
- Server on port 8082, Expo web on port 8081
- External port 3000 maps to API

### Option 2: Hetzner VPS (Recommended for Production)
- See `server/DEPLOYMENT.md` for full guide
- ~€4/month for CX11 VPS
- Docker deployment

### Building APK
- See `EAS_BUILD_GUIDE.md` for instructions
- Requires EAS account on expo.dev
- Must set `projectId` in app.json for push notifications

## Recent Changes
- December 21, 2025:
  - Added push notifications support
  - Created Hetzner deployment files (Dockerfile, docker-compose.yml)
  - Added EAS build guide
  - Smart "Potraži broj" button with conditional behavior
- December 1, 2025: Initial MVP created

## Dependencies
- Expo SDK 54
- React Navigation 7
- expo-notifications (push notifications)
- expo-device (device detection)
- expo-linking, expo-web-browser
- expo-image, react-native-reanimated

## Important Notes
- **No database by design** - in-memory only, data resets on restart
- **Push notifications require EAS Project ID** - set in app.json
- **Scraping every 30 seconds** - Willhaben might block if too aggressive
