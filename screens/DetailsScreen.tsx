import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { usePhone } from "@/context/usePhone";

type DetailsScreenProps = NativeStackScreenProps<RootStackParamList, "Details">;

interface SpecRowProps {
  label: string;
  value: string | null | undefined;
}

function SpecRow({ label, value }: SpecRowProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  if (!value) return null;

  return (
    <View style={styles.specRow}>
      <ThemedText style={[styles.specLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.specValue, { color: colors.text }]}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function DetailsScreen({ route }: DetailsScreenProps) {
  const { vehicle } = route.params;
  const { isDark } = useTheme();
  const { setCurrentPhone } = usePhone();
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    setCurrentPhone(vehicle.phone || null);
  }, [vehicle.phone, setCurrentPhone]);

  const formatPrice = (price: number | null) => {
    if (!price) return "Preis auf Anfrage";
    return new Intl.NumberFormat("de-AT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number | null) => {
    if (!mileage) return null;
    return new Intl.NumberFormat("de-AT").format(mileage) + " km";
  };

  const handleOpenWillhaben = async () => {
    const vehicleId = vehicle.id.replace("wh-", "");
    const url =
      vehicle.willhabenUrl ||
      `https://www.willhaben.at/iad/gebrauchtwagen/d/oglasi/${vehicleId}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Error", "Could not open Willhaben");
    }
  };

  const placeholderImage = "https://via.placeholder.com/400x250.png?text=Auto";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={{ uri: vehicle.imageUrl || placeholderImage }}
        style={styles.heroImage}
        contentFit="cover"
        transition={200}
      />

      <View style={styles.content}>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {vehicle.title}
        </ThemedText>

        <View
          style={[styles.priceCard, { backgroundColor: colors.primary + "1A" }]}
        >
          <ThemedText style={[styles.priceText, { color: colors.primary }]}>
            {formatPrice(vehicle.price)}
          </ThemedText>
        </View>

        <View style={styles.specsContainer}>
          <SpecRow label="Jahr" value={vehicle.year?.toString()} />
          <SpecRow
            label="Kilometerstand"
            value={formatMileage(vehicle.mileage)}
          />
          <SpecRow label="Kraftstoff" value={vehicle.fuelType} />
          <SpecRow label="Standort" value={vehicle.location} />
          {vehicle.phone ? (
            <SpecRow label="Telefon" value={vehicle.phone} />
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleOpenWillhaben}
          style={[styles.willhabenButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="open-outline" size={22} color="#FFFFFF" />
          <ThemedText style={styles.willhabenButtonText}>
            Auf Willhaben ansehen
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  heroImage: {
    width: "100%",
    height: 250,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  priceCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  priceText: {
    fontSize: 22,
    fontWeight: "700",
  },
  specsContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  specLabel: {
    fontSize: 14,
  },
  specValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  willhabenButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  willhabenButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
