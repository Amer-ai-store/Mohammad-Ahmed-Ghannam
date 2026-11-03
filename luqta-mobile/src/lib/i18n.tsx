import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isLang, translate, type Lang } from "./i18nCore";

const KEY = "luqta-lang";
type LangValue = { lang: Lang; setLang: (l: Lang) => void; tr: (s: string) => string };
const Context = createContext<LangValue>({ lang: "ar", setLang: () => {}, tr: (s) => s });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (isLang(v)) setLangState(v); }).catch(() => {}); }, []);
  const setLang = useCallback((l: Lang) => { setLangState(l); void AsyncStorage.setItem(KEY, l).catch(() => {}); }, []);
  const value = useMemo(() => ({ lang, setLang, tr: (s: string) => translate(lang, s) }), [lang, setLang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLang = () => useContext(Context);
