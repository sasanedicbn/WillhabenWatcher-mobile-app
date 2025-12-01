import React, { createContext, useContext, useState, ReactNode } from "react";

interface PhoneContextType {
  currentPhone: string | null;
  setCurrentPhone: (phone: string | null) => void;
}

const PhoneContext = createContext<PhoneContextType | undefined>(undefined);

export function PhoneProvider({ children }: { children: ReactNode }) {
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);

  return (
    <PhoneContext.Provider value={{ currentPhone, setCurrentPhone }}>
      {children}
    </PhoneContext.Provider>
  );
}

export function usePhone() {
  const context = useContext(PhoneContext);
  if (context === undefined) {
    throw new Error("usePhone must be used within a PhoneProvider");
  }
  return context;
}
