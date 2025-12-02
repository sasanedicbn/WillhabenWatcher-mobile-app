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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { Vehicle } from "@/services/api";

interface VehicleCardProps {
  vehicle: Vehicle;
  onCardPress: () => void;
  isNew?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function VehicleCard({ vehicle, onCardPress, isNew }: VehicleCardProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);
  const colors = isDark ? Colors.dark : Colors.light;

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
      `${vehicle.title} ${vehicle.location} kontakt`
    );
    const googleUrl = `https://www.google.com/search?q=${searchQuery}`;

    try {
      await WebBrowser.openBrowserAsync(googleUrl);
    } catch (error) {
      Alert.alert("Error", "Could not open browser");
    }
  };

  const handleChatPress = async () => {
    const vehicleId = vehicle.id.replace('wh-', '');
    const willhabenUrl = vehicle.willhabenUrl || `https://www.willhaben.at/iad/gebrauchtwagen/d/oglasi/${vehicleId}`;

    try {
      await WebBrowser.openBrowserAsync(willhabenUrl);
    } catch {
      Alert.alert("Error", "Could not open Willhaben");
    }
  };

  const handleMessagePress = async () => {
    const vehicleId = vehicle.id.replace('wh-', '');
    const willhabenUrl = vehicle.willhabenUrl || `https://www.willhaben.at/iad/gebrauchtwagen/d/oglasi/${vehicleId}`;
    try {
      await WebBrowser.openBrowserAsync(willhabenUrl);
    } catch {
      Alert.alert("Error", "Could not open browser");
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
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <TouchableOpacity
          onPress={onCardPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={styles.textContent}
        >
          <ThemedText
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {vehicle.title}
          </ThemedText>

          <ThemedText style={[styles.metadata, { color: colors.textSecondary }]}>
            {getMetadata()}
          </ThemedText>

          <ThemedText style={[styles.price, { color: colors.primary }]}>
            {formatPrice(vehicle.price)}
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.iconRow}>
          <TouchableOpacity
            onPress={handleMessagePress}
            activeOpacity={0.6}
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleChatPress}
            activeOpacity={0.6}
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
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
  iconRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
