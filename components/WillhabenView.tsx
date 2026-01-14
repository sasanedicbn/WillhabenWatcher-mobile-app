import React, { useState, useEffect } from "react";
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
import { Platform } from "react-native";

interface WillhabenWebViewProps {
  url: string;
  messageTemplate: string;
}

export const WillhabenWebView: React.FC<WillhabenWebViewProps> = ({
  url,
  messageTemplate,
}) => {
  const [visible, setVisible] = useState(true);

  // ✅ KOPIRANJE PORUKE U CLIPBOARD ODMAH
  useEffect(() => {
    if (messageTemplate) {
      Clipboard.setStringAsync(messageTemplate);
    }
  }, [messageTemplate]);

  // ANDROID BACK BUTTON
  useEffect(() => {
    const backAction = () => {
      if (visible) {
        setVisible(false);
        return true;
      }
      return false;
    };

    BackHandler.addEventListener("hardwareBackPress", backAction);
    return () =>
      BackHandler.removeEventListener("hardwareBackPress", backAction);
  }, [visible]);

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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.backText}>← Nazad</Text>
          </TouchableOpacity>
        </View>

        <WebView
          source={{ uri: url }}
          injectedJavaScript={injectedJS}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: Platform.OS === "ios" ? 90 : 60,
    paddingTop: Platform.OS === "ios" ? 40 : 0,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  backText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ef4444",
  },
});
