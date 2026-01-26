import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, Alert } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { usePhone } from "@/context/PhoneContext";
import { useRadioMode } from "@/context/RadioModeContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { Vehicle } from "@/services/api";
import { DassSchnelleSearch } from "./DasSchneleSearcher";
import { Platform } from "react-native";

interface VehicleCardProps {
  vehicle: Vehicle;
  isNew?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function VehicleCard({ vehicle, isNew }: VehicleCardProps) {
  const { isDark } = useTheme();
  const { setCurrentPhone } = usePhone();
  const { isRadioModeOn } = useRadioMode();
  const colors = isDark ? Colors.dark : Colors.light;

  const [sellerName, setSellerName] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const scale = useSharedValue(1);
  const hasPhone = Boolean(vehicle.phone);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handleImagePress = async () => {
    const nameForSearch = sellerName || vehicle.sellerName || "";
    const query = encodeURIComponent(`${nameForSearch} Telefonnummer`);
    const googleUrl = `https://www.google.com/search?q=${query}`;

    try {
      await WebBrowser.openBrowserAsync(googleUrl);
    } catch {
      Alert.alert("Greška", "Ne mogu otvoriti Google pretragu");
    }
  };

  const handleCardPress = async () => {
    setCurrentPhone(vehicle.phone || null);

    if (isRadioModeOn && hasPhone && vehicle.phone) {
      try {
        const phoneUrl = `tel:${vehicle.phone}`;
        const supported = await Linking.canOpenURL(phoneUrl);
        if (supported) {
          await Linking.openURL(phoneUrl);
          return;
        }
      } catch {}
    }

    const url =
      vehicle.willhabenUrl ||
      `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${vehicle.id.replace(
        "wh-",
        "",
      )}`;

    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Greška", "Ne mogu otvoriti Willhaben oglas");
    }
  };

  const handleMessagePress = () => {
    setCurrentPhone(vehicle.phone || null);
    setModalVisible(true);
  };

  const messageTemplate =
    "Hallöchen 🥰🥰🥰 haben sie kurz Zeit für ein Telefonat er gefällt mir und der preis passt mir auch 06643972640.";

  const willhabenUrl =
    vehicle.willhabenUrl ||
    `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${vehicle.id.replace(
      "wh-",
      "",
    )}`;

  // Injected JS: stable + non-invasive
  const injectedJS = `
(function () {
  const MESSAGE = ${JSON.stringify(messageTemplate)};

  // Ako ne želiš da automatski otvara tastaturu, stavi false
  const DO_FOCUS = true;

  function setNativeValue(el, value) {
    const proto =
      el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;

    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function getTextarea() {
    return (
      document.querySelector('#mailContent') ||
      document.querySelector('textarea[name="mailContent"]')
    );
  }

  function sendSellerName() {
    if (window.__SELLER_SENT__) return;
    const el = document.querySelector('[data-testid="top-contact-box-seller-name"]');
    if (el && el.innerText) {
      window.__SELLER_SENT__ = true;
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: 'SELLER_NAME', value: el.innerText.trim() })
      );
    }
  }

  let programmatic = false;
  let filledOnce = false;

  function hookUserTyping(textarea) {
    if (textarea.dataset.__hooked) return;
    textarea.dataset.__hooked = '1';

    textarea.addEventListener('input', () => {
      if (!programmatic) textarea.dataset.__userTouched = '1';
    });
    textarea.addEventListener('keydown', () => {
      textarea.dataset.__userTouched = '1';
    });
  }

  function scrollToTextarea(textarea) {
    // samo jednom da ne "drma"
    if (textarea.dataset.__scrolled === '1') return;
    textarea.dataset.__scrolled = '1';

    // mali delay da DOM “slegne” i da value već bude upisan
    setTimeout(() => {
      try {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {}

      if (!DO_FOCUS) return;

      // još malo kasnije fokus -> manje šanse da Willhaben "pregazi" value
      setTimeout(() => {
        try {
          textarea.focus();
          // cursor na kraj
          const len = (textarea.value || '').length;
          textarea.setSelectionRange(len, len);
        } catch {}
      }, 200);
    }, 250);
  }

  function fillMessage() {
    const textarea = getTextarea();
    if (!textarea) return false;

    hookUserTyping(textarea);

    // Ako je korisnik već kucao, više ne diraj.
    if (textarea.dataset.__userTouched === '1') {
      filledOnce = true;
      return true;
    }

    // Ako već ima sadržaj, ne diraj.
    const current = (textarea.value || '').trim();
    if (current.length > 0) {
      filledOnce = true;
      scrollToTextarea(textarea);
      return true;
    }

    programmatic = true;
    setNativeValue(textarea, MESSAGE);
    fire(textarea, 'input');
    fire(textarea, 'change');
    programmatic = false;

    filledOnce = true;

    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: 'MSG_INJECTED', ok: true })
    );

    // tek nakon što je value sigurno postavljen -> scroll/focus
    scrollToTextarea(textarea);

    return true;
  }

  // 1) odmah
  fillMessage();
  sendSellerName();

  // 2) retry dok se forma ne pojavi
  let tries = 0;
  const interval = setInterval(() => {
    tries++;
    const ok = fillMessage();
    sendSellerName();
    if (ok || tries > 80) clearInterval(interval);
  }, 300);

  // 3) Observer samo dok jednom ne uspije, pa se gasi
  const mo = new MutationObserver(() => {
    if (filledOnce) return;
    fillMessage();
    sendSellerName();
  });

  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}

  setTimeout(() => {
    try { mo.disconnect(); } catch {}
  }, 15000);
})();
true;
`;

  const formatPrice = (price: number | null) =>
    price
      ? new Intl.NumberFormat("de-AT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(price)
      : "Preis auf Anfrage";

  const formatMileage = (mileage: number | null) =>
    mileage ? new Intl.NumberFormat("de-AT").format(mileage) + " km" : "";

  const getMetadata = () => {
    const parts: string[] = [];
    if (vehicle.year) parts.push(vehicle.year.toString());
    if (vehicle.mileage) parts.push(formatMileage(vehicle.mileage));
    if (vehicle.fuelType) parts.push(vehicle.fuelType);
    if (vehicle.location) {
      parts.push(
        vehicle.postcode
          ? `${vehicle.postcode} ${vehicle.location}`
          : vehicle.location,
      );
    }
    return parts.join(" • ");
  };

  const placeholderImage = "https://via.placeholder.com/200x200.png?text=Auto";

  return (
    <>
      <AnimatedView
        style={[
          styles.card,
          {
            backgroundColor: colors.backgroundDefault,
            borderColor: isNew ? colors.primary : colors.border,
            borderWidth: isNew ? 2 : 1,
          },
          animatedStyle,
        ]}
      >
        {/* SLIKA */}
        <TouchableOpacity
          onPress={handleImagePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.85}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: vehicle.imageUrl || placeholderImage }}
            style={styles.image}
            contentFit="cover"
          />

          {isNew && (
            <View
              style={[styles.newBadge, { backgroundColor: colors.primary }]}
            >
              <ThemedText style={styles.newBadgeText}>NEU</ThemedText>
            </View>
          )}

          {hasPhone && (
            <View
              style={[
                styles.phoneBadge,
                { backgroundColor: isRadioModeOn ? "#22C55E" : "#6B7280" },
              ]}
            >
              <Ionicons name="call" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* TEKST */}
        <View style={styles.contentContainer}>
          <TouchableOpacity
            onPress={handleCardPress}
            activeOpacity={0.9}
            style={styles.textContent}
          >
            <View style={styles.titleRow}>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                {vehicle.title}
              </ThemedText>

              {hasPhone && (
                <View
                  style={[
                    styles.phoneTag,
                    { backgroundColor: isRadioModeOn ? "#22C55E" : "#3B82F6" },
                  ]}
                >
                  <Ionicons name="call" size={14} color="#FFF" />
                  <ThemedText style={styles.phoneTagText}>TEL</ThemedText>
                </View>
              )}
            </View>

            <ThemedText
              style={[styles.metadata, { color: colors.textSecondary }]}
            >
              {getMetadata()}
            </ThemedText>

            <ThemedText style={[styles.price, { color: colors.primary }]}>
              {formatPrice(vehicle.price)}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.buttonColumn}>
            <TouchableOpacity
              onPress={handleMessagePress}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="mail-outline" size={16} color="#FFF" />
              <ThemedText style={styles.buttonText}>Pošalji poruku</ThemedText>
            </TouchableOpacity>

            <DassSchnelleSearch
              vehicle={{
                ...vehicle,
                sellerName: sellerName,
              }}
            />
          </View>
        </View>
      </AnimatedView>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: willhabenUrl }}
            injectedJavaScriptBeforeContentLoaded={injectedJS}
            injectedJavaScript={injectedJS}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "SELLER_NAME") setSellerName(data.value);
              } catch {}
            }}
          />

          {/* NAZAD DUGME */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setModalVisible(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <ThemedText style={styles.backButtonText}>Nazad</ThemedText>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
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

  card: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  newBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  phoneBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  phoneTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  phoneTagText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  metadata: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  buttonColumn: {
    flexDirection: "column",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    marginLeft: 4,
  },
});
