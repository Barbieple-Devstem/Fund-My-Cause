"use client";

import React, { createContext, useContext, ReactNode } from "react";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  initialTheme = "dark",
  onThemeChange,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    onThemeChange?.(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error(
      "useTheme must be used within a ThemeProvider. Wrap your component tree with <ThemeProvider>.",
    );
  }
  return context;
}
