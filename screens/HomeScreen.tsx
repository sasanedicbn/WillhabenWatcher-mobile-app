import React, { useEffect, useState, useCallback, useRef } from "react";
import { StyleSheet, RefreshControl, ActivityIndicator, View, AppState } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { VehicleCard } from "@/components/VehicleCard";
import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import Spacer from "@/components/Spacer";
import { Spacing, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { useNewCarSound } from "@/hooks/useNewCarSound";
import { fetchVehicles, markVehiclesAsSeen, Vehicle } from "@/services/api";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

const POLL_INTERVAL = 10000;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { isDark } = useTheme();
  const { setCurrentPhone } = usePhone();
  const { playNewCarSound } = useNewCarSound();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastScrapeTime, setLastScrapeTime] = useState<string | null>(null);
  const [newCarCount, setNewCarCount] = useState(0);
  const previousVehicleIds = useRef<Set<string>>(new Set());
  const colors = isDark ? Colors.dark : Colors.light;

  const loadVehicles = useCallback(async (isRefresh = false) => {
    try {
      const data = await fetchVehicles();
      
      if (data.vehicles.length > 0) {
        const newIds = new Set(data.vehicles.map(v => v.id));
        const actuallyNew = data.vehicles.filter(v => !previousVehicleIds.current.has(v.id));
        
        if (previousVehicleIds.current.size > 0 && actuallyNew.length > 0) {
          console.log(`Found ${actuallyNew.length} new vehicles!`);
          setNewCarCount(prev => prev + actuallyNew.length);
          playNewCarSound();
        }
        
        previousVehicleIds.current = newIds;
      }
      
      setVehicles(data.vehicles);
      setLastScrapeTime(data.lastScrapeTime);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playNewCarSound]);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadVehicles();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [loadVehicles]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadVehicles();
      }
    });

    return () => subscription?.remove();
  }, [loadVehicles]);

  useEffect(() => {
    if (vehicles.length > 0 && vehicles[0].phone) {
      setCurrentPhone(vehicles[0].phone);
    }
  }, [vehicles, setCurrentPhone]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVehicles(true);
  }, [loadVehicles]);

  const handleCardPress = (vehicle: Vehicle) => {
    setCurrentPhone(vehicle.phone || null);
    navigation.navigate("Details", { vehicle });
  };

  const handleClearNewCount = async () => {
    setNewCarCount(0);
    await markVehiclesAsSeen();
  };

  const renderItem = ({ item, index }: { item: Vehicle; index: number }) => (
    <>
      <VehicleCard 
        vehicle={item} 
        onCardPress={() => handleCardPress(item)}
        isNew={item.isNew} 
      />
      {index < vehicles.length - 1 ? <Spacer height={Spacing.md} /> : null}
    </>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {newCarCount > 0 ? (
        <View style={[styles.newCarBanner, { backgroundColor: colors.primary }]}>
          <ThemedText style={styles.newCarText}>
            {newCarCount} neue Fahrzeuge gefunden!
          </ThemedText>
        </View>
      ) : null}
      {lastScrapeTime ? (
        <ThemedText style={[styles.lastUpdate, { color: colors.textSecondary }]}>
          Letzte Aktualisierung: {new Date(lastScrapeTime).toLocaleTimeString('de-AT')}
        </ThemedText>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundRoot }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          Lade Fahrzeuge von Willhaben...
        </ThemedText>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.backgroundRoot }]}>
        <ThemedText style={styles.emptyText}>Keine Fahrzeuge verfügbar</ThemedText>
        <ThemedText style={[styles.emptyHint, { color: colors.textSecondary }]}>
          Willhaben wird alle 30 Sekunden gescannt
        </ThemedText>
      </View>
    );
  }

  return (
    <ScreenFlatList
      data={vehicles}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
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
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyHint: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  headerContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  newCarBanner: {
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.sm,
  },
  newCarText: {
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
  },
  lastUpdate: {
    fontSize: 12,
    textAlign: "center",
  },
});
