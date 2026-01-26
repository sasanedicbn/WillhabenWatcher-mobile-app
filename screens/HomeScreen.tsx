import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  View,
  AppState,
} from "react-native";

import { VehicleCard } from "@/components/VehicleCard";
import { ScreenFlatList } from "@/components/ScreenFlatList";
import { ThemedText } from "@/components/ThemedText";
import Spacer from "@/components/Spacer";
import { Spacing, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { useNewCarSound } from "@/hooks/useNewCarSound";
import {
  fetchNewVehicles,
  fetchVehicles,
  markVehiclesAsSeen,
  Vehicle,
} from "@/services/api";
import * as Notifications from "expo-notifications";

// Danju agresivno (može), noću rijetko
const DAY_MIN_INTERVAL = 500;
const DAY_MAX_INTERVAL = 1200;

function computeNextInterval(): number {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const isNightTime = h === 23 || (h >= 0 && h < 5) || (h === 5 && m < 50);

  if (isNightTime) {
    return 40 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
  }

  return (
    DAY_MIN_INTERVAL + Math.random() * (DAY_MAX_INTERVAL - DAY_MIN_INTERVAL)
  );
}

export default function HomeScreen() {
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

  // Guard da ne radiš paralelne fetch-eve (najbitnije)
  const inFlightRef = useRef(false);

  const loadVehicles = useCallback(
    async (isRefresh = false) => {
      // Ako je već u toku, ne dupliraj
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        if (!isRefresh) setLoading((prev) => (prev ? true : prev));

        const data = await fetchVehicles();

        const privateVehicles = data.vehicles.filter(
          (v) => v.isPrivate === true,
        );

        if (privateVehicles.length > 0) {
          const newIds = new Set(privateVehicles.map((v) => v.id));
          const actuallyNew = privateVehicles.filter(
            (v) => !previousVehicleIds.current.has(v.id),
          );

          if (previousVehicleIds.current.size > 0 && actuallyNew.length > 0) {
            setNewCarCount((prev) => prev + actuallyNew.length);
            playNewCarSound();
          }

          previousVehicleIds.current = newIds;
        } else {
          previousVehicleIds.current = new Set();
        }

        setVehicles(privateVehicles);
        setLastScrapeTime(data.lastScrapeTime);
      } catch (error) {
        console.error("❌ Error fetching vehicles:", error);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [playNewCarSound],
  );

  // 1) Push-notification listener (kad notifikacija stigne -> povuci /new)
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      async () => {
        try {
          const data = await fetchNewVehicles();

          if (data.vehicles.length > 0) {
            setVehicles((prev) => {
              const existingIds = new Set(prev.map((v) => v.id));
              const uniqueNew = data.vehicles.filter(
                (v) => !existingIds.has(v.id),
              );
              return [...uniqueNew, ...prev];
            });

            setNewCarCount((prev) => prev + data.vehicles.length);
            playNewCarSound();

            await markVehiclesAsSeen();
          }
        } catch (e) {
          console.error("❌ Error handling notification refresh:", e);
        }
      },
    );

    return () => subscription.remove();
  }, [playNewCarSound]);

  // 2) Polling: odma load, pa onda zakazuj sljedeći (NE čeka prvih 1.5–3s)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      await loadVehicles(false);

      if (cancelled) return;
      timeoutId = setTimeout(tick, computeNextInterval());
    };

    tick(); // ✅ odmah

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadVehicles]);

  // 3) Kad se app vrati u foreground, uradi instant refresh (bez overlap-a)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadVehicles(false);
      }
    });

    return () => subscription.remove();
  }, [loadVehicles]);

  // 4) Phone “side effect”
  useEffect(() => {
    if (vehicles.length > 0 && vehicles[0]?.phone) {
      setCurrentPhone(vehicles[0].phone);
    }
  }, [vehicles, setCurrentPhone]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadVehicles(true);
  }, [loadVehicles]);

  const renderItem = ({ item, index }: { item: Vehicle; index: number }) => (
    <>
      <VehicleCard vehicle={item} isNew={item.isNew} />
      {index < vehicles.length - 1 ? <Spacer height={Spacing.md} /> : null}
    </>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {newCarCount > 0 && (
        <View
          style={[styles.newCarBanner, { backgroundColor: colors.primary }]}
        >
          <ThemedText style={styles.newCarText}>
            {newCarCount} neue Fahrzeuge gefunden!
          </ThemedText>
        </View>
      )}

      {lastScrapeTime && (
        <ThemedText
          style={[styles.lastUpdate, { color: colors.textSecondary }]}
        >
          Letzte Aktualisierung:{" "}
          {new Date(lastScrapeTime).toLocaleTimeString("de-AT")}
        </ThemedText>
      )}
    </View>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText
          style={[styles.loadingText, { color: colors.textSecondary }]}
        >
          Lade Fahrzeuge von Willhaben...
        </ThemedText>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: colors.backgroundRoot },
        ]}
      >
        <ThemedText style={styles.emptyText}>
          Keine Fahrzeuge verfügbar
        </ThemedText>
        <ThemedText style={[styles.emptyHint, { color: colors.textSecondary }]}>
          Auto-Refresh aktiv (Tag: 1.5–3s, Nacht: ~40min)
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
