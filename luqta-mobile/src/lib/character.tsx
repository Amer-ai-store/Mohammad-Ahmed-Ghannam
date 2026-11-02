// Companion character profile: appearance, size, motion and sound preferences.
// Stored on the device only. The processed face (256 px JPEG) never leaves the phone.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo } from "react-native";
import { api } from "./api";

import { DEFAULT_CHARACTER, sanitizeCharacter, type CharacterProfile } from "./characterProfile";

export * from "./characterProfile";

const KEY = "luqta-character-v1";

type Value = {
  profile: CharacterProfile;
  hydrated: boolean;
  systemReduceMotion: boolean;
  /** professional GLB configured from the dashboard (settings.character.modelUrl); undefined = built-in model */
  modelUrl?: string;
  update: (patch: Partial<CharacterProfile>) => void;
  save: (next: CharacterProfile) => Promise<void>;
  removePhoto: () => Promise<void>;
  reset: () => Promise<void>;
};
const Context = createContext<Value | null>(null);

export function CharacterProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CharacterProfile>(DEFAULT_CHARACTER);
  const [hydrated, setHydrated] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const [modelUrl, setModelUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    api.get<{ settings?: { character?: { modelUrl?: string | null } } }>("/settings")
      .then((r) => { const u = r.settings?.character?.modelUrl; if (active && typeof u === "string" && /^https:\/\/\S+\.(glb|gltf)(\?\S*)?$/i.test(u)) setModelUrl(u); })
      .catch(() => { /* demo / offline: built-in model */ });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY).then((raw) => { if (active && raw) { try { setProfile(sanitizeCharacter(JSON.parse(raw))); } catch { /* ignore corrupt profile */ } } })
      .catch(() => {}).finally(() => { if (active) setHydrated(true); });
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (active) setSystemReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v: boolean) => setSystemReduceMotion(!!v));
    return () => { active = false; sub?.remove?.(); };
  }, []);
  const persist = useCallback(async (next: CharacterProfile) => { await AsyncStorage.setItem(KEY, JSON.stringify(next)); }, []);
  const update = useCallback((patch: Partial<CharacterProfile>) => setProfile((p) => sanitizeCharacter({ ...p, ...patch })), []);
  const save = useCallback(async (next: CharacterProfile) => { const clean = sanitizeCharacter(next); setProfile(clean); await persist(clean); }, [persist]);
  const removePhoto = useCallback(async () => { const next = { ...profile, faceDataUrl: undefined, consentAt: undefined }; setProfile(next); await persist(next); }, [profile, persist]);
  const reset = useCallback(async () => { setProfile(DEFAULT_CHARACTER); await AsyncStorage.removeItem(KEY); }, []);
  const value = useMemo(() => ({ profile, hydrated, systemReduceMotion, modelUrl, update, save, removePhoto, reset }), [profile, hydrated, systemReduceMotion, modelUrl, update, save, removePhoto, reset]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Lets a preview render the companion with an unsaved draft profile. */
export const CharacterContextOverride = Context.Provider;

export function useCharacter() {
  const v = useContext(Context);
  if (!v) throw new Error("CharacterProvider is required");
  return v;
}
