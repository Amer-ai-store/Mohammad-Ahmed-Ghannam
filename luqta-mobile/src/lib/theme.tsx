import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const theme = {
  background: "#F8F7F4",
  paper: "#FFFFFF",
  ink: "#252A27",
  muted: "#656B62",
  orange: "#B94721",
  orangeSoft: "#FFF0E7",
  line: "#DEDFD7",
  green: "#356549",
  secondary: "#EBEDE7",
  success: "#356549",
  danger: "#B52D33",
  onAccent: "#FFFFFF",
  imageBackground: "#F1F0EB",
  toast: "#252A27",
  onToast: "#FFFFFF",
};

export type Palette = typeof theme;
export type ThemeMode = "light" | "dark" | "system";
export const darkTheme: Palette = {
  background: "#121815",
  paper: "#1C2420",
  ink: "#F3F4EF",
  muted: "#B6BBB3",
  orange: "#F2946E",
  orangeSoft: "#3A271E",
  line: "#3A443D",
  green: "#8AC7A3",
  secondary: "#29362D",
  success: "#8AC7A3",
  danger: "#FF9B9F",
  onAccent: "#29160D",
  imageBackground: "#29302C",
  toast: "#E3EBE2",
  onToast: "#18201A",
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
