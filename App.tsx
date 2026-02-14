import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RadioModeProvider } from "@/context/RadioModeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PhoneProviderSecond } from "./context/usePhone";

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <NotificationProvider>
              <RadioModeProvider>
                <PhoneProviderSecond>
                  <NavigationContainer>
                    <RootStackNavigator />
                  </NavigationContainer>
                </PhoneProviderSecond>
              </RadioModeProvider>
            </NotificationProvider>
            <StatusBar style="auto" />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
