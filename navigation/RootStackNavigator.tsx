import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, Pressable, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";

import HomeScreen from "@/screens/HomeScreen";
import DetailsScreen from "@/screens/DetailsScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useRadioMode } from "@/context/RadioModeContext";
import { usePhone } from "@/context/PhoneContext";
import { Spacing, Colors } from "@/constants/theme";
import { Vehicle } from "@/services/api";

export type RootStackParamList = {
  Home: undefined;
  Details: { vehicle: Vehicle };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderLeft() {
  const { isDark } = useTheme();
  const { isRadioModeOn, toggleRadioMode } = useRadioMode();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Switch
      value={isRadioModeOn}
      onValueChange={toggleRadioMode}
      trackColor={{ false: colors.border, true: colors.success }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.border}
      accessibilityLabel="Anrufmodus umschalten"
      accessibilityHint="Aktivieren um Telefonanrufe zu ermöglichen"
    />
  );
}

function HeaderRight() {
  const { isDark } = useTheme();
  const { isRadioModeOn } = useRadioMode();
  const { currentPhone } = usePhone();
  const colors = isDark ? Colors.dark : Colors.light;

  const handlePhoneCall = async () => {
    if (!isRadioModeOn) {
      Alert.alert("Anrufmodus deaktiviert", "Aktiviere den Anrufmodus um anzurufen");
      return;
    }

    if (!currentPhone) {
      Alert.alert("Keine Nummer", "Keine Telefonnummer für dieses Fahrzeug verfügbar");
      return;
    }

    try {
      const phoneUrl = `tel:${currentPhone}`;
      const supported = await Linking.canOpenURL(phoneUrl);
      if (supported) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Fehler", "Anrufe werden auf diesem Gerät nicht unterstützt");
      }
    } catch (error) {
      Alert.alert("Fehler", "Anruf konnte nicht gestartet werden");
    }
  };

  const isActive = isRadioModeOn && currentPhone;

  return (
    <Pressable
      onPress={handlePhoneCall}
      style={({ pressed }) => [
        styles.callButton,
        { 
          backgroundColor: isActive ? colors.success : colors.backgroundSecondary,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Verkäufer anrufen"
      accessibilityHint={
        isActive
          ? "Doppeltippen um den Verkäufer anzurufen"
          : "Aktiviere den Anrufmodus und wähle ein Fahrzeug mit Telefonnummer"
      }
    >
      <Ionicons
        name="call"
        size={18}
        color={isActive ? "#FFFFFF" : colors.textSecondary}
      />
      <ThemedText style={[styles.callButtonText, { color: isActive ? "#FFFFFF" : colors.textSecondary }]}>
        Pozovi
      </ThemedText>
    </Pressable>
  );
}

export default function RootStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Willhaben Cars" />,
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <HeaderRight />,
        }}
      />
      <Stack.Screen
        name="Details"
        component={DetailsScreen}
        options={{
          headerTitle: "Vehicle Details",
          headerBackTitle: "Back",
          headerTransparent: false,
          headerStyle: {
            backgroundColor: theme.backgroundDefault,
          },
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    gap: Spacing.xs,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
