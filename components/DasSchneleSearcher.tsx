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
        // button.click(); // ako želiš da odmah klikne search, možeš otkomentirati
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
          style={styles.closeButton}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.closeText}>Zatvori</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  closeButton: {
    backgroundColor: "#ef4444",
    padding: 12,
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
  },
});
