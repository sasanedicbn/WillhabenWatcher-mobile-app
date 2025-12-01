import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { SimilarVehicleCard } from "@/components/SimilarVehicleCard";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { getSimilarVehicles, Vehicle } from "@/data/mockVehicles";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type DetailsScreenProps = NativeStackScreenProps<RootStackParamList, "Details">;

interface SpecRowProps {
  label: string;
  value: string;
}

function SpecRow({ label, value }: SpecRowProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

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

  const similarVehicles = getSimilarVehicles(vehicle.id);

  useEffect(() => {
    setCurrentPhone(vehicle.phone || null);
  }, [vehicle.phone, setCurrentPhone]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const renderSimilarItem = ({ item }: { item: Vehicle }) => (
    <View style={styles.similarItemWrapper}>
      <SimilarVehicleCard vehicle={item} />
    </View>
  );

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
        source={{ uri: vehicle.imageUrl }}
        style={styles.heroImage}
        contentFit="cover"
        transition={200}
      />

      <View style={styles.content}>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {vehicle.title}
        </ThemedText>

        <View
          style={[
            styles.priceCard,
            { backgroundColor: colors.primary + "1A" },
          ]}
        >
          <ThemedText style={[styles.priceText, { color: colors.primary }]}>
            {formatPrice(vehicle.price)}
          </ThemedText>
        </View>

        <View style={styles.specsContainer}>
          <SpecRow label="Year" value={vehicle.year.toString()} />
          <SpecRow label="Mileage" value={formatMileage(vehicle.mileage)} />
          <SpecRow label="Expiration" value={formatDate(vehicle.expirationDate)} />
          <SpecRow label="Fuel Type" value={vehicle.fuelType} />
          <SpecRow label="Transmission" value={vehicle.transmission} />
          <SpecRow label="Power" value={vehicle.power} />
          <SpecRow label="Body Type" value={vehicle.bodyType} />
          <SpecRow label="Color" value={vehicle.color} />
          <SpecRow label="Doors" value={vehicle.doors.toString()} />
          <SpecRow label="Seats" value={vehicle.seats.toString()} />
          <SpecRow label="Previous Owners" value={vehicle.previousOwners.toString()} />
          <SpecRow label="Location" value={vehicle.location} />
          {vehicle.phone ? (
            <SpecRow label="Phone" value={vehicle.phone} />
          ) : null}
        </View>

        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {vehicle.description}
        </ThemedText>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Similar Vehicles
        </ThemedText>

        <FlatList
          data={similarVehicles}
          renderItem={renderSimilarItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.similarList}
          scrollEnabled
        />
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
  description: {
    marginTop: Spacing.lg,
    fontSize: 14,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  similarList: {
    paddingRight: Spacing.lg,
  },
  similarItemWrapper: {
    marginRight: Spacing.md,
  },
});
