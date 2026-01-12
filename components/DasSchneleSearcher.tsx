import React, { useState } from "react";
import { View, Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export function DassSchnelleSearch({ vehicle }: { vehicle: any }) {
  const [modalVisible, setModalVisible] = useState(false);

  const fullName = vehicle.sellerName?.trim() || "Max Mustermann";
  const postcode = vehicle.postcode || "";
  const city = vehicle.location || "";

  const searchLocation = `${postcode ? postcode + " " : ""}${city}`;

  const injectedJS = `
    const whatInput = document.querySelector('#what');
    const whereInput = document.querySelector('#where');
    const searchButton = document.querySelector('button[type="submit"]');

    if (whatInput && whereInput && searchButton) {
      whatInput.value = '${fullName}';
      whereInput.value = '${searchLocation}';
      searchButton.click();
    }
    true; // mora za React Native WebView
  `;

  const handleOpen = () => setModalVisible(true);

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={handleOpen} style={styles.button}>
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
    margin: 16,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  closeButton: {
    backgroundColor: "#ef4444",
    padding: 12,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "bold" },
});
