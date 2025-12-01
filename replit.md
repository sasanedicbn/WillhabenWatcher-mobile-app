# Willhaben Cars - React Native Expo App

## Overview
A React Native Expo mobile application for browsing car listings from Willhaben (Austria). The app displays vehicle cards with images, prices, and specifications, allowing users to interact with listings through Google search, Willhaben deep links, and phone calls.

## Current State
- **Version**: 1.0.0
- **Last Updated**: December 1, 2025
- **Status**: MVP Complete

## Features
1. **Vehicle List Screen**
   - Scrollable list of vehicle cards sorted by newest
   - Each card shows: image, title, year, mileage, price
   - Message and chat action icons

2. **Navigation Bar**
   - "Logout" button (displays alert - no auth)
   - Headphone icon for phone calls
   - Radio toggle to enable/disable call mode

3. **Card Interactions**
   - Tap image: Opens Google search for vehicle + location + "kontakt"
   - Tap card body: Navigates to Details screen
   - Tap message/chat icons: Opens Willhaben app (deep link) or web fallback

4. **Details Screen**
   - Full vehicle specifications
   - Price card with primary color styling
   - Similar vehicles horizontal scroll list
   - Each similar vehicle links to Willhaben

5. **Phone Call Feature**
   - When radio mode is ON and vehicle has phone number
   - Headphone icon triggers phone call via `tel:` link

## Project Architecture

### File Structure
```
/
├── App.tsx                 # Root component with providers
├── app.json               # Expo configuration
├── components/
│   ├── VehicleCard.tsx    # Main vehicle card component
│   ├── SimilarVehicleCard.tsx  # Mini card for similar vehicles
│   ├── HeaderTitle.tsx    # Custom header with app icon
│   ├── ErrorBoundary.tsx  # Error handling wrapper
│   └── ...                # Shared components
├── context/
│   ├── RadioModeContext.tsx   # Phone call mode state
│   └── PhoneContext.tsx       # Current phone number state
├── data/
│   └── mockVehicles.ts    # Mock vehicle data
├── navigation/
│   ├── RootStackNavigator.tsx  # Main stack navigator
│   └── screenOptions.ts       # Shared screen options
├── screens/
│   ├── HomeScreen.tsx     # Vehicle list
│   └── DetailsScreen.tsx  # Vehicle details
├── constants/
│   └── theme.ts           # Colors, spacing, typography
└── hooks/
    ├── useScreenInsets.ts # Safe area handling
    └── useTheme.ts        # Theme hook
```

### Navigation
- Stack-based navigation (no tab bar)
- Two screens: Home and Details
- Transparent header on Home screen
- Standard header on Details screen

### State Management
- React Context for radio mode and phone number
- Local state for vehicle data loading
- No external state management library

### Styling
- Custom theme in `constants/theme.ts`
- Primary color: #1E40AF (deep blue)
- Success color: #10B981 (green for toggle)
- Consistent border radius and spacing

## User Preferences
- No authentication required (personal use app)
- Mock data API (ready for real API integration)
- Austrian locale formatting (EUR currency, German dates)

## Recent Changes
- December 1, 2025: Initial MVP created
  - Implemented vehicle list with cards
  - Added details screen with specifications
  - Integrated Willhaben deep linking
  - Added phone call functionality with radio toggle
  - Generated app icon

## Dependencies
- Expo SDK 54
- React Navigation 7
- expo-linking (for deep links and phone calls)
- expo-web-browser (for opening browser URLs)
- expo-image (for optimized images)
- react-native-reanimated (for animations)

## Next Steps (Future Enhancements)
1. Integrate real Willhaben RSS feed or API
2. Add push notifications for new listings
3. Implement search and filtering
4. Add favorites with AsyncStorage persistence
5. Background sync for new vehicle alerts
