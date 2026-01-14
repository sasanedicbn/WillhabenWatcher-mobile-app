import React, { useState, useRef } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  SafeAreaView,
} from "react-native";
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

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ flex: 1, position: "relative" }}>
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            injectedJavaScript={injectedJS}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
          />

          {/* Dugme za izlaz */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.backButtonText}>Nazad</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30, // malo više na iOS zbog notch
    right: 20,
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 999,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
