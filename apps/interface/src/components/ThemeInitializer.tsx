"use client";

import { useEffect, useState } from "react";
import { useTheme, type Theme } from "@fund-my-cause/components";

/**
 * Applies the persisted/system theme on first mount and keeps the document
 * root's class + localStorage in sync with the theme context. Gates rendering
 * of children until the client-only theme resolution has run, so we never
 * flash the wrong theme.
 */
export function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, [setTheme]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("theme", theme);
      if (theme === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      }
    }
  }, [theme, mounted]);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
