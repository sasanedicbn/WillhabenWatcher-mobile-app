import React, { useState } from "react";
import { View, Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export function DassSchnelleSearch({ vehicle }: { vehicle: any }) {
  const [modalVisible, setModalVisible] = useState(false);

  const fullName = vehicle.sellerName?.trim() || "Max Mustermann";
  const postcode = vehicle.postcode || "";
  const city = vehicle.location || "";
  const location = `${postcode ? postcode + " " : ""}${city}`.trim();

  const injectedJS = `
    (function () {
      const tryFill = () => {
        const what = document.querySelector('input[name="what"], #what');
        const where = document.querySelector('input[name="where"], #where');
        const button = document.querySelector('button[type="submit"]');

        if (what && where) {
          what.focus();
          what.value = '${fullName}';
          what.dispatchEvent(new Event('input', { bubbles: true }));

          where.focus();
          where.value = '${location}';
          where.dispatchEvent(new Event('input', { bubbles: true }));

          if (button) button.click();
          return true;
        }
        return false;
      };

      const interval = setInterval(() => {
        if (tryFill()) clearInterval(interval);
      }, 300);
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
          source={{ uri: "https://www.dasschnelle.at/" }}
          injectedJavaScript={injectedJS}
          javaScriptEnabled
          domStorageEnabled
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
    backgroundColor: "#6366F1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    margin: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
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
