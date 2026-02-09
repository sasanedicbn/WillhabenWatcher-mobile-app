import { Ionicons } from "@expo/vector-icons";
import React, { useState, useRef } from "react";
import { View, Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export function DassSchnelleSearch({ vehicle }: { vehicle: any }) {
  const [modalVisible, setModalVisible] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const fullName = vehicle.sellerName?.trim() || "Max Mustermann";
  const postcode = vehicle.postcode || "";
  const city = vehicle.location || "";
  const location = `${postcode ? postcode + " " : ""}${city}`.trim();

  const injectedJS = `
    (function () {
      if (window.__DASS_DONE__) return;
      window.__DASS_DONE__ = true;

      const what = document.querySelector('input[name="what"], #what');
      const where = document.querySelector('input[name="where"], #where');
      const button = document.querySelector('button[type="submit"]');

      if (what && where) {
        what.focus();
        what.value = ${JSON.stringify(fullName)};
        what.dispatchEvent(new Event('input', { bubbles: true }));

        where.focus();
        where.value = ${JSON.stringify(location)};
        where.dispatchEvent(new Event('input', { bubbles: true }));

        // ne klikamo odmah submita da se ne pretražuje automatski
        button.click(); // ako želiš da odmah klikne search, možeš otkomentirati
      }
    })();
    true;
  `;

  return (
    <View>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Pretraži prodavca</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide">
        <WebView
          ref={webViewRef}
          source={{ uri: "https://www.dasschnelle.at/" }}
          javaScriptEnabled
          domStorageEnabled
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript(injectedJS);
          }}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setModalVisible(false)}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
          <Text style={styles.backButtonText}>Nazad</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    left: 16,
    top: "20%",
    transform: [{ translateY: -22 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    zIndex: 999,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#6366F1",
    gap: 6,
    marginVertical: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 12,
  },
});
