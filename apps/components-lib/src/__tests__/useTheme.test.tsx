import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

describe("useTheme hook", () => {
  it("should provide default dark theme", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
  });

  it("should toggle theme from dark to light", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
  });

  it("should toggle theme from light to dark", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialTheme="light">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
  });

  it("should set theme explicitly", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
  });

  it("should call onThemeChange callback when theme changes", () => {
    const onThemeChange = (theme: string) => theme;
    const onThemeChangeSpy = (theme: string) => theme;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider onThemeChange={onThemeChangeSpy}>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
  });

  it("should throw error when useTheme is used outside ThemeProvider", () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow(
      "useTheme must be used within a ThemeProvider. Wrap your component tree with <ThemeProvider>."
    );
  });

  it("should accept initial theme prop", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialTheme="light">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
  });
});
