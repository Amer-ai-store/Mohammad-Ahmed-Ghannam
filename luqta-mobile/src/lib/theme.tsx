import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Design tokens from the لُقطة × Amer AI Store mockups: lavender surfaces, deep-purple ink, coral calls to action.
// `orange` keeps its historical name across screens and holds the coral accent.
export const theme = {
  background: "#F5F2FF",
  paper: "#FFFFFF",
  ink: "#241B4B",
  muted: "#6E6890",
  orange: "#FF6B4A",
  orangeSoft: "#FFEDE8",
  line: "#E6E0F7",
  green: "#1F9D6B",
  secondary: "#EEE9FF",
  success: "#1F9D6B",
  danger: "#D93B54",
  onAccent: "#FFFFFF",
  imageBackground: "#F1ECFF",
  toast: "#241B4B",
  onToast: "#FFFFFF",
  primary: "#5B3FD6",
  primarySoft: "#E9E3FF",
  onPrimary: "#FFFFFF",
  warning: "#E69A17",
  warningSoft: "#FFF4DD",
  successSoft: "#E3F6EE",
  shadow: "#3B2A8A",
};

export type Palette = typeof theme;
export type ThemeMode = "light" | "dark" | "system";
export const darkTheme: Palette = {
  background: "#100C22",
  paper: "#1C1636",
  ink: "#F4F1FF",
  muted: "#B4ADD6",
  orange: "#FF8A6E",
  orangeSoft: "#3B2128",
  line: "#342B5E",
  green: "#5FD3A1",
  secondary: "#272051",
  success: "#5FD3A1",
  danger: "#FF8597",
  onAccent: "#2A0F08",
  imageBackground: "#251E47",
  toast: "#ECE8FF",
  onToast: "#1A1433",
  primary: "#A893FF",
  primarySoft: "#2B2257",
  onPrimary: "#160F33",
  warning: "#FFC35C",
  warningSoft: "#3A2E14",
  successSoft: "#143528",
  shadow: "#000000",
};
// Stores created before the redesign saved this rust colour as their accent; it now means "use the design accent".
const LEGACY_ACCENT = "#B94721";

type ThemeValue = {
  colors: Palette;
  mode: ThemeMode;
  isDark: boolean;
  hydrated: boolean;
  storageError: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string | null) => void;
};
const Context = createContext<ThemeValue>({
  colors: theme,
  mode: "system",
  isDark: false,
  hydrated: false,
  storageError: false,
  setMode: () => {},
  setAccentColor: () => {},
});
const STORAGE_KEY = "luqta-appearance-v1";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme();
  const [mode, setPreference] = useState<ThemeMode>("system");
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === "light" || saved === "dark" || saved === "system"))
          setPreference(saved);
      })
      .catch(() => {
        if (active) setStorageError(true);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, mode)
      .then(() => setStorageError(false))
      .catch(() => setStorageError(true));
  }, [mode, hydrated]);
  const isDark = mode === "dark" || (mode === "system" && systemMode === "dark");
  const colors = useMemo<Palette>(() => ({ ...(isDark ? darkTheme : theme), ...(accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) && accentColor.toUpperCase() !== LEGACY_ACCENT ? { orange: accentColor } : {}) }), [isDark, accentColor]);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    document.documentElement.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
  }, [isDark, colors]);
  const value = useMemo<ThemeValue>(
    () => ({
      colors,
      mode,
      isDark,
      hydrated,
      storageError,
      setAccentColor,
      setMode: (next) => {
        if (next === "light" || next === "dark" || next === "system")
          setPreference(next);
      },
    }),
    [colors, mode, isDark, hydrated, storageError],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTheme() {
  return useContext(Context);
}

export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
