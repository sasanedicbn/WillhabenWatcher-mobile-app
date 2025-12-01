import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
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
import { Vehicle } from "@/data/mockVehicles";

interface VehicleCardProps {
  vehicle: Vehicle;
  onCardPress: () => void;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function VehicleCard({ vehicle, onCardPress }: VehicleCardProps) {
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
    const willhabenDeepLink = `willhaben://ad/${vehicle.id}/chat`;
    const willhabenWebUrl = `https://www.willhaben.at/iad/gebrauchtwagen/d/oglasi/${vehicle.id}`;

    try {
      const canOpen = await Linking.canOpenURL(willhabenDeepLink);
      if (canOpen) {
        await Linking.openURL(willhabenDeepLink);
      } else {
        await WebBrowser.openBrowserAsync(willhabenWebUrl);
      }
    } catch (error) {
      try {
        await WebBrowser.openBrowserAsync(willhabenWebUrl);
      } catch {
        Alert.alert("Error", "Could not open Willhaben");
      }
    }
  };

  const handleMessagePress = async () => {
    const willhabenWebUrl = `https://www.willhaben.at/iad/gebrauchtwagen/d/oglasi/${vehicle.id}`;
    try {
      await WebBrowser.openBrowserAsync(willhabenWebUrl);
    } catch {
      Alert.alert("Error", "Could not open browser");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number) => {
    return new Intl.NumberFormat("de-AT").format(mileage) + " km";
  };

  return (
    <AnimatedView
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundDefault,
          borderColor: colors.border,
        },
        animatedStyle,
      ]}
      accessibilityLabel={`${vehicle.title}, ${vehicle.year}, ${formatMileage(vehicle.mileage)}, ${formatPrice(vehicle.price)}`}
    >
      <TouchableOpacity
        onPress={handleImagePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: vehicle.imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
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
            {vehicle.year} • {formatMileage(vehicle.mileage)}
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
            <Feather name="mail" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleChatPress}
            activeOpacity={0.6}
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
          >
            <Feather name="message-circle" size={18} color={colors.textSecondary} />
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
    borderWidth: 1,
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
  },
  image: {
    width: "100%",
    height: "100%",
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
