import React, { useState, useRef } from "react";
import { View, Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface WillhabenWebViewProps {
  url: string;
  messageTemplate: string;
}

export const WillhabenWebView: React.FC<WillhabenWebViewProps> = ({
  url,
  messageTemplate,
}) => {
  const [modalVisible, setModalVisible] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const injectedJS = `
    (function () {
      const MESSAGE = ${JSON.stringify(messageTemplate)};

      function fill() {
        const textarea = document.querySelector('#mailContent');
        if (!textarea) return false;

        textarea.focus();
        textarea.value = MESSAGE;

        // trigger events da React vidi promjenu
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        // scrollaj do textarea da bude vidljivo
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });

        return true;
      }

      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (fill() || tries > 15) clearInterval(interval);
      }, 500);
    })();
    true;
  `;

  return (
    <Modal visible={modalVisible} animationType="slide">
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
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
  );
};

const styles = StyleSheet.create({
  closeButton: {
    backgroundColor: "#ef4444",
    padding: 12,
    alignItems: "center",
    margin: 12,
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
  },
});
