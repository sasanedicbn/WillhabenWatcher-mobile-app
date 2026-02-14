import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PhoneContextType {
  currentPhone: string | null;
  setCurrentPhone: (phone: string | null) => void;
  isLoading: boolean;
}

const PhoneContext = createContext<PhoneContextType | undefined>(undefined);

const PHONE_STORAGE_KEY = "@user_phone_number";

function PhoneProviderSecond({ children }: { children: ReactNode }) {
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Učitaj sačuvani broj kad se app pokrene
  useEffect(() => {
    loadSavedPhone();
  }, []);

  const loadSavedPhone = async () => {
    try {
      const savedPhone = await AsyncStorage.getItem(PHONE_STORAGE_KEY);
      if (savedPhone) {
        setCurrentPhone(savedPhone);
      }
    } catch (error) {
      console.error("Greška pri učitavanju broja:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sačuvaj broj kad se promijeni
  const savePhone = async (phone: string | null) => {
    try {
      if (phone) {
        await AsyncStorage.setItem(PHONE_STORAGE_KEY, phone);
      } else {
        await AsyncStorage.removeItem(PHONE_STORAGE_KEY);
      }
      setCurrentPhone(phone);
    } catch (error) {
      console.error("Greška pri čuvanju broja:", error);
    }
  };

  return (
    <PhoneContext.Provider
      value={{
        currentPhone,
        setCurrentPhone: savePhone,
        isLoading,
      }}
    >
      {children}
    </PhoneContext.Provider>
  );
}

function usePhone() {
  const context = useContext(PhoneContext);
  if (context === undefined) {
    throw new Error("usePhone must be used within a PhoneProvider");
  }
  return context;
}

export { PhoneProviderSecond, usePhone };
