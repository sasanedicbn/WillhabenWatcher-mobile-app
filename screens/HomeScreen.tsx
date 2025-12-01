import React, { useEffect, useState, useCallback, useMemo } from "react";
import { StyleSheet, RefreshControl, ActivityIndicator, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { VehicleCard } from "@/components/VehicleCard";
import { ScreenFlatList } from "@/components/ScreenFlatList";
import { SearchFilterBar, FilterOptions } from "@/components/SearchFilterBar";
import { ThemedText } from "@/components/ThemedText";
import Spacer from "@/components/Spacer";
import { Spacing, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { Vehicle, getSortedVehicles } from "@/data/mockVehicles";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

const defaultFilters: FilterOptions = {
  minPrice: "",
  maxPrice: "",
  minYear: "",
  maxYear: "",
  fuelType: "Alle",
  bodyType: "Alle",
  location: "Alle",
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { isDark } = useTheme();
  const { setCurrentPhone } = usePhone();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const colors = isDark ? Colors.dark : Colors.light;

  const fetchVehicles = useCallback(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const data = getSortedVehicles();
      setVehicles(data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (vehicles.length > 0 && vehicles[0].phone) {
      setCurrentPhone(vehicles[0].phone);
    }
  }, [vehicles, setCurrentPhone]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          vehicle.title.toLowerCase().includes(query) ||
          vehicle.location.toLowerCase().includes(query) ||
          vehicle.fuelType.toLowerCase().includes(query) ||
          vehicle.bodyType.toLowerCase().includes(query) ||
          vehicle.color.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (filters.minPrice) {
        const minPrice = parseInt(filters.minPrice, 10);
        if (!isNaN(minPrice) && vehicle.price < minPrice) return false;
      }

      if (filters.maxPrice) {
        const maxPrice = parseInt(filters.maxPrice, 10);
        if (!isNaN(maxPrice) && vehicle.price > maxPrice) return false;
      }

      if (filters.minYear) {
        const minYear = parseInt(filters.minYear, 10);
        if (!isNaN(minYear) && vehicle.year < minYear) return false;
      }

      if (filters.maxYear) {
        const maxYear = parseInt(filters.maxYear, 10);
        if (!isNaN(maxYear) && vehicle.year > maxYear) return false;
      }

      if (filters.fuelType !== "Alle" && vehicle.fuelType !== filters.fuelType) {
        return false;
      }

      if (filters.bodyType !== "Alle" && vehicle.bodyType !== filters.bodyType) {
        return false;
      }

      if (filters.location !== "Alle" && vehicle.location !== filters.location) {
        return false;
      }

      return true;
    });
  }, [vehicles, searchQuery, filters]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVehicles();
  }, [fetchVehicles]);

  const handleCardPress = (vehicle: Vehicle) => {
    setCurrentPhone(vehicle.phone || null);
    navigation.navigate("Details", { vehicle });
  };

  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery("");
  };

  const renderItem = ({ item, index }: { item: Vehicle; index: number }) => (
    <>
      <VehicleCard vehicle={item} onCardPress={() => handleCardPress(item)} />
      {index < filteredVehicles.length - 1 ? <Spacer height={Spacing.md} /> : null}
    </>
  );

  const renderHeader = () => (
    <SearchFilterBar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filters={filters}
      onFiltersChange={setFilters}
      onClearFilters={handleClearFilters}
    />
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundRoot }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.backgroundRoot }]}>
        <ThemedText style={styles.emptyText}>No vehicles available</ThemedText>
      </View>
    );
  }

  return (
    <ScreenFlatList
      data={filteredVehicles}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        <View style={styles.noResultsContainer}>
          <ThemedText style={[styles.noResultsText, { color: colors.textSecondary }]}>
            Keine Fahrzeuge gefunden
          </ThemedText>
          <ThemedText style={[styles.noResultsHint, { color: colors.textSecondary }]}>
            Versuchen Sie andere Suchbegriffe oder Filter
          </ThemedText>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  noResultsHint: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
