# Design Guidelines: Willhaben Car Listings Monitor

## Architecture Decisions

### Authentication
**No authentication required.** This is a personal utility app with a single user accessing data from a mock API. However, the "Logout" button in the top navigation should be implemented as a placeholder that displays an alert: "No account connected" when pressed.

### Navigation
**Stack Navigation** - The app has a single feature area (vehicle browsing) with two primary screens:
- Main Screen (Vehicle List)
- Details Screen

No tab bar is needed. All navigation happens through card interactions and back gestures.

---

## Screen Specifications

### Main Screen — Vehicle List

**Purpose:** Browse the most recent car listings from Willhaben in a scrollable feed.

**Header:**
- Custom header (not default navigation header)
- Transparent background
- Height: 60px
- Left: "Logout" text button (14pt, gray color)
- Right: Two elements aligned horizontally
  - Headphone icon (24x24px)
  - Radio toggle switch (when ON: primary color, OFF: gray)
- No search bar

**Layout:**
- Root view: Scrollable vertical list (FlatList)
- Top inset: `insets.top + 60 (headerHeight) + Spacing.md`
- Bottom inset: `insets.bottom + Spacing.xl`
- Card spacing: Spacing.md between cards
- Horizontal padding: Spacing.lg

**Components:**
- Vehicle Card (repeating component):
  - Background: White with subtle border (1px, lightGray)
  - Border radius: 12px
  - Padding: Spacing.md
  - Shadow: subtle (shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: {width: 0, height: 2})
  - Layout: Horizontal split
    - Left: Square vehicle image (100x100px, borderRadius: 8px)
    - Right: Content column
      - Title (16pt semibold, 2 lines max with ellipsis)
      - Year + Mileage (14pt regular, gray)
      - Price (18pt bold, primary color)
      - Icon row: Message (✉️) and Chat (💬) icons (20x20px, Spacing.md apart)

**Interactions:**
- Entire card: subtle scale down to 0.98 on press
- Image area: no additional visual feedback (relies on card press feedback)
- Icon buttons: scale to 0.9 on press with slight opacity reduction (0.6)

---

### Details Screen

**Purpose:** View full specifications for a selected vehicle.

**Header:**
- Default navigation header
- Title: "Vehicle Details"
- Left: Back button (chevron-left icon)
- Background: White (non-transparent)
- No right buttons

**Layout:**
- Root view: Scrollable content (ScrollView)
- Top inset: Spacing.xl (header is non-transparent)
- Bottom inset: `insets.bottom + Spacing.xl`
- Horizontal padding: Spacing.lg

**Components (stacked vertically):**
1. Hero Image (full width, 250px height, borderRadius: 12px)
2. Title (24pt bold, Spacing.lg below image)
3. Price Card:
   - Background: light primary color (10% opacity)
   - Padding: Spacing.md
   - Border radius: 8px
   - Price text: 22pt bold, primary color
4. Specifications Grid:
   - Each spec row: Label (14pt gray) + Value (16pt semibold black)
   - Spacing between rows: Spacing.sm
   - Include: Year, Mileage, Expiration Date
5. Divider line (1px, lightGray, Spacing.lg vertical margins)
6. "Similar Vehicles" Section:
   - Heading: "Similar Vehicles" (18pt semibold)
   - Horizontal scrollable list of mini cards
   - Mini card: 160px wide, image + title + price
   - Spacing between cards: Spacing.md

---

## Design System

### Color Palette
- **Primary:** #1E40AF (deep blue, for prices and key actions)
- **Secondary:** #6B7280 (gray, for metadata like year/mileage)
- **Background:** #F9FAFB (light gray background)
- **Card Background:** #FFFFFF (white)
- **Border:** #E5E7EB (light gray)
- **Text Primary:** #111827 (near black)
- **Text Secondary:** #6B7280 (gray)
- **Success:** #10B981 (green, for radio toggle ON state)
- **Error:** #EF4444 (red, if needed for warnings)

### Typography
- **Title (Vehicle Card):** 16pt, semibold, textPrimary
- **Details Title:** 24pt, bold, textPrimary
- **Price (Card):** 18pt, bold, primary
- **Price (Details):** 22pt, bold, primary
- **Metadata:** 14pt, regular, textSecondary
- **Spec Labels:** 14pt, regular, textSecondary
- **Spec Values:** 16pt, semibold, textPrimary
- **Button Text:** 14pt, semibold

### Spacing
```
Spacing.xs: 4px
Spacing.sm: 8px
Spacing.md: 16px
Spacing.lg: 24px
Spacing.xl: 32px
```

### Visual Design
- **Icons:** Use Feather icons from @expo/vector-icons for headphone, message, chat, back button
- **Pressable Feedback:** All touchable elements scale to 0.98 on press with 100ms duration
- **Shadows:** Use sparingly—only on vehicle cards and floating elements
- **Border Radius:** Consistent 12px for cards, 8px for images and smaller components
- **Radio Toggle:** Use React Native Switch component with primary color when ON

### Assets Required
**Critical Assets:**
1. **Placeholder car images** (5-6 variations):
   - Style: Modern, clean car photos or illustrated car silhouettes
   - Aspect ratio: 1:1 (square) for cards
   - Resolution: 300x300px minimum
   - Aesthetic: Professional automotive photography style or minimalist vector illustrations
   - Examples: sedan, SUV, hatchback, sports car

**Note:** Do NOT use emojis for message/chat icons. Use Feather "mail" and "message-circle" icons instead.

---

## Accessibility Requirements
- All touchable elements minimum 44x44pt target size
- Color contrast ratio 4.5:1 for text
- Headphone icon and radio toggle should have accessible labels for screen readers
- Vehicle cards should announce full content: "Title, Year, Mileage, Price"
- Support system font scaling