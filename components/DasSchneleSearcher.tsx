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

  // JS koji se injektuje ali se **ne pokreće odmah** – pokreće se kad korisnik klikne "Pretraži"
  const injectedJS = (runSearch: boolean) => `
    (function () {
      if (!${runSearch}) return;

      const what = document.querySelector('input[name="what"], #what');
      const where = document.querySelector('input[name="where"], #where');
      const button = document.querySelector('button[type="submit"]');

      if (what && where && button) {
        what.value = ${JSON.stringify(fullName)};
        what.dispatchEvent(new Event('input', { bubbles: true }));

        where.value = ${JSON.stringify(location)};
        where.dispatchEvent(new Event('input', { bubbles: true }));

        button.scrollIntoView({behavior:'smooth', block:'center'});
        setTimeout(() => button.click(), 300);
      }
    })();
    true;
  `;

  const [runSearch, setRunSearch] = useState(false);

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
            if (runSearch)
              webViewRef.current?.injectJavaScript(injectedJS(true));
          }}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => {
              setRunSearch(true);
              webViewRef.current?.injectJavaScript(injectedJS(true));
            }}
          >
            <Text style={styles.buttonText}>Pokreni pretragu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeText}>Zatvori</Text>
          </TouchableOpacity>
        </View>
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
    marginTop: 8,
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 12,
  },
  searchButton: {
    backgroundColor: "#10B981",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
