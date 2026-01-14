import React, { useEffect, useState } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  BackHandler,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";

interface WillhabenWebViewProps {
  url: string;
  messageTemplate: string;
}

export function WillhabenWebView({
  url,
  messageTemplate,
}: WillhabenWebViewProps) {
  const [visible, setVisible] = useState(true);

  // ✅ Kopiraj poruku (radi iako se ne vidi)
  useEffect(() => {
    Clipboard.setStringAsync(messageTemplate);
  }, [messageTemplate]);

  // ✅ Android back → zatvori modal
  useEffect(() => {
    const backAction = () => {
      setVisible(false);
      return true;
    };

    BackHandler.addEventListener("hardwareBackPress", backAction);
    return () =>
      BackHandler.removeEventListener("hardwareBackPress", backAction);
  }, []);

  const injectedJS = `
    (function () {
      const MESSAGE = ${JSON.stringify(messageTemplate)};
      let tries = 0;

      const interval = setInterval(() => {
        const textarea = document.querySelector('#mailContent');
        if (textarea) {
          textarea.focus();
          textarea.value = MESSAGE;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.scrollIntoView({ block: 'center' });
          clearInterval(interval);
        }
        if (++tries > 15) clearInterval(interval);
      }, 500);
    })();
    true;
  `;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1 }}>
        {/* WEBVIEW */}
        <WebView
          source={{ uri: url }}
          injectedJavaScript={injectedJS}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
        />

        {/* ISTO KAO DASS SCHNELLE */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setVisible(false)}
        >
          <Text style={styles.closeText}>Zatvori</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    backgroundColor: "#ef4444",
    padding: 14,
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
