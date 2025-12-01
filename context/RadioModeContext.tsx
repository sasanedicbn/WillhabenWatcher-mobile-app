import React, { createContext, useContext, useState, ReactNode } from "react";

interface RadioModeContextType {
  isRadioModeOn: boolean;
  toggleRadioMode: () => void;
}

const RadioModeContext = createContext<RadioModeContextType | undefined>(undefined);

export function RadioModeProvider({ children }: { children: ReactNode }) {
  const [isRadioModeOn, setIsRadioModeOn] = useState(false);

  const toggleRadioMode = () => {
    setIsRadioModeOn((prev) => !prev);
  };

  return (
    <RadioModeContext.Provider value={{ isRadioModeOn, toggleRadioMode }}>
      {children}
    </RadioModeContext.Provider>
  );
}

export function useRadioMode() {
  const context = useContext(RadioModeContext);
  if (context === undefined) {
    throw new Error("useRadioMode must be used within a RadioModeProvider");
  }
  return context;
}
