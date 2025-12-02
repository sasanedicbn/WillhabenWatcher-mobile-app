import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, Pressable, Switch, View, StyleSheet } from "react-native";
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
  const { theme } = useTheme();

  const handleLogout = () => {
    Alert.alert("Logout", "No account connected");
  };

  return (
    <Pressable
      onPress={handleLogout}
      style={({ pressed }) => [
        styles.headerButton,
        { opacity: pressed ? 0.6 : 1 },
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <ThemedText
        style={[styles.logoutText, { color: theme.textSecondary }]}
      >
        Logout
      </ThemedText>
    </Pressable>
  );
}

function HeaderRight() {
  const { theme, isDark } = useTheme();
  const { isRadioModeOn, toggleRadioMode } = useRadioMode();
  const { currentPhone } = usePhone();

  const handlePhoneCall = async () => {
    if (!isRadioModeOn) {
      Alert.alert("Radio Mode Off", "Enable radio mode to make calls");
      return;
    }

    if (!currentPhone) {
      Alert.alert("No Phone", "No phone number available for this vehicle");
      return;
    }

    try {
      const phoneUrl = `tel:${currentPhone}`;
      const supported = await Linking.canOpenURL(phoneUrl);
      if (supported) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Error", "Phone calls are not supported on this device");
      }
    } catch (error) {
      Alert.alert("Error", "Could not initiate phone call");
    }
  };

  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View style={styles.headerRightContainer}>
      <Pressable
        onPress={handlePhoneCall}
        style={({ pressed }) => [
          styles.iconButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Call seller"
        accessibilityHint={
          isRadioModeOn && currentPhone
            ? "Double tap to call the seller"
            : "Enable radio mode and select a vehicle with a phone number to call"
        }
      >
        <Ionicons
          name="call"
          size={24}
          color={isRadioModeOn && currentPhone ? colors.primary : theme.textSecondary}
        />
      </Pressable>
      <Switch
        value={isRadioModeOn}
        onValueChange={toggleRadioMode}
        trackColor={{ false: theme.border, true: colors.success }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={theme.border}
        accessibilityLabel="Radio mode toggle"
        accessibilityHint="Toggle to enable or disable phone call functionality"
      />
    </View>
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
  headerButton: {
    paddingVertical: Spacing.xs,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "400",
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconButton: {
    padding: Spacing.xs,
  },
});
