import React from "react";
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { useRadioMode } from "@/context/RadioModeContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { Vehicle } from "@/services/api";

interface VehicleCardProps {
  vehicle: Vehicle;
  isNew?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function VehicleCard({ vehicle, isNew }: VehicleCardProps) {
  const { isDark } = useTheme();
  const { setCurrentPhone } = usePhone();
  const { isRadioModeOn } = useRadioMode();
  const scale = useSharedValue(1);
  const colors = isDark ? Colors.dark : Colors.light;
  const hasPhone = Boolean(vehicle.phone);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handleImagePress = async () => {
    const searchQuery = encodeURIComponent(
      `${vehicle.title} ${vehicle.location} telefon kontakt`
    );
    const googleUrl = `https://www.google.com/search?q=${searchQuery}`;

    try {
      await WebBrowser.openBrowserAsync(googleUrl);
    } catch (error) {
      Alert.alert("Error", "Could not open browser");
    }
  };

  const handleCardPress = async () => {
    setCurrentPhone(vehicle.phone || null);

    if (isRadioModeOn && hasPhone && vehicle.phone) {
      try {
        const phoneUrl = `tel:${vehicle.phone}`;
        const supported = await Linking.canOpenURL(phoneUrl);
        if (supported) {
          await Linking.openURL(phoneUrl);
        } else {
          Alert.alert("Greška", "Pozivi nisu podržani na ovom uređaju");
        }
      } catch {
        Alert.alert("Greška", "Nije moguće pokrenuti poziv");
      }
      return;
    }

    const url = vehicle.willhabenUrl || `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${vehicle.id.replace('wh-', '')}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Error", "Could not open Willhaben");
    }
  };

  const handleSearchSeller = async () => {
    // If radio mode is ON and vehicle has phone, call directly
    if (isRadioModeOn && hasPhone && vehicle.phone) {
      try {
        const phoneUrl = `tel:${vehicle.phone}`;
        const supported = await Linking.canOpenURL(phoneUrl);
        if (supported) {
          await Linking.openURL(phoneUrl);
        } else {
          Alert.alert("Fehler", "Anrufe werden auf diesem Gerät nicht unterstützt");
        }
      } catch {
        Alert.alert("Fehler", "Anruf konnte nicht gestartet werden");
      }
      return;
    }
    
    // Extract postal code from location (Austrian postal codes are 4 digits)
    const location = vehicle.location || '';
    const postalCodeMatch = location.match(/\d{4}/);
    const postalCode = postalCodeMatch ? postalCodeMatch[0] : (location || 'Österreich');
    
    // Use seller name for "what" field and postal code for "where" field
    const sellerName = vehicle.sellerName || '';
    const searchQuery = encodeURIComponent(sellerName);
    const locationQuery = encodeURIComponent(postalCode);
    const dasSchnelleUrl = `https://www.dasschnelle.at/ergebnisse?what=${searchQuery}&where=${locationQuery}`;
    
    try {
      await WebBrowser.openBrowserAsync(dasSchnelleUrl);
    } catch {
      Alert.alert("Fehler", "Die Suche konnte nicht geöffnet werden");
    }
  };

  const handleMessagePress = async () => {
    setCurrentPhone(vehicle.phone || null);
    const messageTemplate = `Hallöchen 🥰🥰🥰 haben Sie kurz Zeit für ein Telefonat? Er gefällt mir und der Preis passt mir auch.
Bitte melden Sie sich bei mir, ich bin ein seriöser und verlässlicher Käufer.
06643972640`;

    try {
      await Clipboard.setStringAsync(messageTemplate);
      Alert.alert(
        "Poruka kopirana!",
        "Poruka je kopirana u clipboard. Sad idi na stranicu i zalijepi je.",
        [
          {
            text: "Zatvori",
            style: "cancel",
          },
          {
            text: "Otvori Willhaben",
            onPress: async () => {
              const url = vehicle.willhabenUrl || `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${vehicle.id.replace('wh-', '')}`;
              await WebBrowser.openBrowserAsync(url);
            },
          },
        ]
      );
    } catch (error) {
      console.error("Clipboard error:", error);
      Alert.alert(
        "Greska",
        "Nije moguce kopirati poruku. Pokusavam otvoriti Willhaben direktno.",
        [
          {
            text: "OK",
            onPress: async () => {
              const url = vehicle.willhabenUrl || `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${vehicle.id.replace('wh-', '')}`;
              await WebBrowser.openBrowserAsync(url);
            },
          },
        ]
      );
    }
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "Preis auf Anfrage";
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number | null) => {
    if (!mileage) return "";
    return new Intl.NumberFormat("de-AT").format(mileage) + " km";
  };

  const getMetadata = () => {
    const parts = [];
    if (vehicle.year) parts.push(vehicle.year.toString());
    if (vehicle.mileage) parts.push(formatMileage(vehicle.mileage));
    if (vehicle.fuelType) parts.push(vehicle.fuelType);
    return parts.join(" • ") || vehicle.location;
  };

  const placeholderImage = "https://via.placeholder.com/200x200.png?text=Auto";

  return (
    <AnimatedView
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundDefault,
          borderColor: isNew ? colors.primary : colors.border,
          borderWidth: isNew ? 2 : 1,
        },
        animatedStyle,
      ]}
      accessibilityLabel={`${vehicle.title}, ${vehicle.year || 'Jahr unbekannt'}, ${formatPrice(vehicle.price)}`}
    >
      <TouchableOpacity
        onPress={handleImagePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: vehicle.imageUrl || placeholderImage }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        {isNew ? (
          <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.newBadgeText}>NEU</ThemedText>
          </View>
        ) : null}
        {hasPhone ? (
          <View style={[styles.phoneBadge, { backgroundColor: isRadioModeOn ? "#22C55E" : "#6B7280" }]}>
            <Ionicons name="call" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <TouchableOpacity
          onPress={handleCardPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={styles.textContent}
        >
          <View style={styles.titleRow}>
            <ThemedText
              style={[styles.title, { color: colors.text, flex: 1 }]}
              numberOfLines={2}
            >
              {vehicle.title}
            </ThemedText>
            {hasPhone ? (
              <View style={[styles.phoneTag, { backgroundColor: isRadioModeOn ? "#22C55E" : "#3B82F6" }]}>
                <Ionicons name="call" size={14} color="#FFFFFF" />
                <ThemedText style={styles.phoneTagText}>TEL</ThemedText>
              </View>
            ) : null}
          </View>

          <ThemedText style={[styles.metadata, { color: colors.textSecondary }]}>
            {getMetadata()}
          </ThemedText>

          <ThemedText style={[styles.price, { color: colors.primary }]}>
            {formatPrice(vehicle.price)}
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.buttonColumn}>
          <TouchableOpacity
            onPress={handleMessagePress}
            activeOpacity={0.6}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Pošalji poruku</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSearchSeller}
            activeOpacity={0.6}
            style={[styles.actionButton, { backgroundColor: isRadioModeOn && hasPhone ? "#22C55E" : "#6366F1" }]}
          >
            <Ionicons name={isRadioModeOn && hasPhone ? "call" : "search"} size={16} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Potraži broj</ThemedText>
            {isRadioModeOn && hasPhone ? (
              <View style={styles.greenDot} />
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  newBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  phoneBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  phoneTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  phoneTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  metadata: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  buttonColumn: {
    flexDirection: "column",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    marginLeft: 4,
  },
});
