import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface WillhabenWebViewProps {
  url: string; // link do oglasa
  messageTemplate: string; // poruka koju želiš ubaciti
}

export const WillhabenWebView: React.FC<WillhabenWebViewProps> = ({
  url,
  messageTemplate,
}) => {
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

        return true;
      }

      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (fill() || tries > 10) clearInterval(interval);
      }, 500);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: url }}
        injectedJavaScript={injectedJS}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
