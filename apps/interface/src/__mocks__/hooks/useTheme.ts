// Manual mock for @/hooks/useTheme — returns dark theme by default.
export function useTheme() {
  return { theme: "dark" as const, toggleTheme: jest.fn() };
}
