import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

export interface FilterOptions {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  fuelType: string;
  bodyType: string;
  location: string;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
}

const FUEL_TYPES = ["Alle", "Benzin", "Diesel", "Elektro", "Hybrid"];
const BODY_TYPES = ["Alle", "Limousine", "Kombi", "SUV", "Hatchback", "Coupe"];
const LOCATIONS = ["Alle", "Wien", "Graz", "Salzburg", "Linz", "Innsbruck", "Klagenfurt"];

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onClearFilters,
}: SearchFilterBarProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.minYear !== "" ||
    filters.maxYear !== "" ||
    filters.fuelType !== "Alle" ||
    filters.bodyType !== "Alle" ||
    filters.location !== "Alle";

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const renderFilterChip = (
    label: string,
    options: string[],
    selected: string,
    onSelect: (value: string) => void
  ) => (
    <View style={styles.filterSection}>
      <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    selected === option
                      ? colors.primary
                      : colors.backgroundSecondary,
                  borderColor: selected === option ? colors.primary : colors.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.chipText,
                  { color: selected === option ? "#FFFFFF" : colors.text },
                ]}
              >
                {option}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Fahrzeug suchen..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => onSearchChange("")}>
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={[
            styles.filterButton,
            {
              backgroundColor: hasActiveFilters
                ? colors.primary
                : colors.backgroundSecondary,
              borderColor: hasActiveFilters ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="sliders"
            size={20}
            color={hasActiveFilters ? "#FFFFFF" : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                Filter
              </ThemedText>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.priceRow}>
                <View style={styles.priceInputContainer}>
                  <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>
                    Min. Preis
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    value={filters.minPrice}
                    onChangeText={(v) => handleFilterChange("minPrice", v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceInputContainer}>
                  <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>
                    Max. Preis
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="100000"
                    placeholderTextColor={colors.textSecondary}
                    value={filters.maxPrice}
                    onChangeText={(v) => handleFilterChange("maxPrice", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceInputContainer}>
                  <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>
                    Min. Jahr
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="2015"
                    placeholderTextColor={colors.textSecondary}
                    value={filters.minYear}
                    onChangeText={(v) => handleFilterChange("minYear", v)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceInputContainer}>
                  <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>
                    Max. Jahr
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.priceInput,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="2024"
                    placeholderTextColor={colors.textSecondary}
                    value={filters.maxYear}
                    onChangeText={(v) => handleFilterChange("maxYear", v)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {renderFilterChip("Kraftstoff", FUEL_TYPES, filters.fuelType, (v) =>
                handleFilterChange("fuelType", v)
              )}

              {renderFilterChip("Karosserie", BODY_TYPES, filters.bodyType, (v) =>
                handleFilterChange("bodyType", v)
              )}

              {renderFilterChip("Standort", LOCATIONS, filters.location, (v) =>
                handleFilterChange("location", v)
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  onClearFilters();
                  setShowFilters(false);
                }}
                style={[
                  styles.clearButton,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ThemedText style={{ color: colors.text }}>Zurucksetzen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                style={[styles.applyButton, { backgroundColor: colors.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Anwenden
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === "android" ? Spacing.sm : 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  clearButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  applyButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
