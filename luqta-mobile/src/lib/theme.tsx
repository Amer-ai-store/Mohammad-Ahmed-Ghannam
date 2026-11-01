import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Palette sampled from the Amer AI Store | لُقطة reference designs (purple/coral).
export const theme = {
  background: "#F6F2FE",
  backgroundDeep: "#EDE7FB",
  paper: "#FFFFFF",
  card: "#FCFBFE",
  ink: "#1F0A47",
  title: "#130050",
  muted: "#826BA2",
  mutedSoft: "#9891B0",
  orange: "#FE585C",
  orangeSoft: "#FCEBF2",
  chip: "#FADDE5",
  purple: "#6E4AA6",
  purpleSoft: "#ECE5FC",
  field: "#F5F1FE",
  line: "#E9E2F7",
  green: "#08844F",
  successSoft: "#DEF0E8",
  info: "#146CF8",
  infoSoft: "#E0EBFD",
  warn: "#BC7B2A",
  warnSoft: "#FEF4D5",
  discount: "#0AA470",
  secondary: "#F3EFFC",
  success: "#08844F",
  danger: "#E5363D",
  onAccent: "#FFFFFF",
  imageBackground: "#FFFFFF",
  toast: "#1F0A47",
  onToast: "#FFFFFF",
  shadow: "#5B3FA8",
};

export type Palette = typeof theme;
export type ThemeMode = "light" | "dark" | "system";
export const darkTheme: Palette = {
  background: "#140D26",
  backgroundDeep: "#0F0A1E",
  paper: "#1E1636",
  card: "#221A3D",
  ink: "#F2EDFF",
  title: "#FFFFFF",
  muted: "#B9A9DA",
  mutedSoft: "#9C90BB",
  orange: "#FF6E71",
  orangeSoft: "#3A1F35",
  chip: "#4A2236",
  purple: "#A68BE0",
  purpleSoft: "#2E2450",
  field: "#2A2147",
  line: "#3A2F5C",
  green: "#6FD3A6",
  successSoft: "#173A2C",
  info: "#7FB0FF",
  infoSoft: "#1B2A4A",
  warn: "#F0C27A",
  warnSoft: "#3D3018",
  discount: "#6FD3A6",
  secondary: "#2A2147",
  success: "#6FD3A6",
  danger: "#FF8D92",
  onAccent: "#FFFFFF",
  imageBackground: "#FFFFFF",
  toast: "#F2EDFF",
  onToast: "#140D26",
  shadow: "#000000",
};

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
  const colors = useMemo<Palette>(() => ({ ...(isDark ? darkTheme : theme), ...(accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? { orange: accentColor } : {}) }), [isDark, accentColor]);
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
