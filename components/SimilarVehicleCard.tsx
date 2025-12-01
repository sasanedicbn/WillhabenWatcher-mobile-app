import React from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { Image } from "expo-image";
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

interface SimilarVehicleCardProps {
  vehicle: Vehicle;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SimilarVehicleCard({ vehicle }: SimilarVehicleCardProps) {
  const { isDark } = useTheme();
  const scale = useSharedValue(1);
  const colors = isDark ? Colors.dark : Colors.light;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = async () => {
    const willhabenDeepLink = `willhaben://ad/${vehicle.id}`;
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundDefault,
          borderColor: colors.border,
        },
        animatedStyle,
      ]}
      accessibilityLabel={`${vehicle.title}, ${formatPrice(vehicle.price)}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: vehicle.imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.content}>
        <ThemedText
          style={[styles.title, { color: colors.text }]}
          numberOfLines={2}
        >
          {vehicle.title}
        </ThemedText>
        <ThemedText style={[styles.price, { color: colors.primary }]}>
          {formatPrice(vehicle.price)}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
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
  image: {
    width: "100%",
    height: 100,
  },
  content: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
});
