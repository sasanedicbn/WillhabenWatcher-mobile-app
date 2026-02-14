import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { usePhone } from "@/context/usePhone";

interface PhoneInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (phone: string) => void; // ✅ DODATO
}

export function PhoneInputModal({
  visible,
  onClose,
  onSaved,
}: PhoneInputModalProps) {
  const { setCurrentPhone, currentPhone } = usePhone();
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const [phoneNumber, setPhoneNumber] = useState("");

  // ✅ prefill kad se modal otvori
  useEffect(() => {
    if (visible) setPhoneNumber(currentPhone ?? "");
  }, [visible, currentPhone]);

  const cleaned = useMemo(
    () => phoneNumber.replace(/\s+/g, "").trim(),
    [phoneNumber],
  );

  const handleSave = async () => {
    if (!cleaned) {
      Alert.alert("Greška", "Molimo unesite broj telefona");
      return;
    }

    if (!/^(?:\+|00|0)[1-9][0-9]{7,14}$/.test(cleaned)) {
      Alert.alert(
        "Greška",
        "Molimo unesite validan broj telefona (npr. +43 664 1234567 ili 0664 1234567)",
      );
      return;
    }

    try {
      await setCurrentPhone(cleaned); // ✅ AsyncStorage + state
      onClose();
      onSaved?.(cleaned); // ✅ nastavi flow (otvori WebView)
    } catch (e) {
      Alert.alert("Greška", "Ne mogu sačuvati broj. Pokušaj ponovo.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: colors.backgroundDefault },
          ]}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              Unesite vaš broj telefona
            </ThemedText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="+43 664 123 4567"
            placeholderTextColor={colors.textSecondary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.saveButtonText}>Sačuvaj broj</ThemedText>
          </TouchableOpacity>

          <ThemedText style={[styles.note, { color: colors.textSecondary }]}>
            Broj će biti sačuvan i automatski korišten za slanje poruka
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  saveButton: {
    height: 50,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  note: {
    fontSize: 12,
    textAlign: "center",
  },
});
