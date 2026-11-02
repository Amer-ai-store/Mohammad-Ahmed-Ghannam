// Companion character profile: appearance, size, motion and sound preferences.
// Stored on the device only. The processed face (256 px JPEG) never leaves the phone.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo } from "react-native";
import type { AvatarProfile } from "../components/character/characterHtml";

export type CharacterProfile = {
  faceDataUrl?: string;
  skin: string;
  hair: string;
  outfit: string;
  pants: string;
  beard: boolean;
  /** 0.25 (≈ quarter, default) … 1.0 */
  scale: number;
  reduceMotion: boolean;
  sound: boolean;
  enabled3d: boolean;
  consentAt?: string;
  createdAt?: string;
};

export const outfitSwatches = ["#141414", "#C9252B", "#F25A5E", "#5B2BE0"] as const;
export const DEFAULT_CHARACTER: CharacterProfile = {
  skin: "#E0A27C", hair: "#3F281B", outfit: "#141414", pants: "#C4161B", beard: true,
  scale: 0.25, reduceMotion: false, sound: true, enabled3d: true,
};
const KEY = "luqta-character-v1";
export const clampScale = (v: number) => Math.min(1, Math.max(0.25, Math.round(v * 100) / 100));
const hex = (v: unknown, fb: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);

export function sanitizeCharacter(value: unknown): CharacterProfile {
  const r = (value && typeof value === "object" ? value : {}) as Partial<CharacterProfile>;
  const face = typeof r.faceDataUrl === "string" && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(r.faceDataUrl) && r.faceDataUrl.length < 400_000 ? r.faceDataUrl : undefined;
  return {
    faceDataUrl: face,
    skin: hex(r.skin, DEFAULT_CHARACTER.skin), hair: hex(r.hair, DEFAULT_CHARACTER.hair),
    outfit: hex(r.outfit, DEFAULT_CHARACTER.outfit), pants: hex(r.pants, DEFAULT_CHARACTER.pants),
    beard: r.beard !== false, scale: clampScale(Number.isFinite(r.scale) ? Number(r.scale) : DEFAULT_CHARACTER.scale),
    reduceMotion: r.reduceMotion === true, sound: r.sound !== false, enabled3d: r.enabled3d !== false,
    consentAt: typeof r.consentAt === "string" ? r.consentAt : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
  };
}

export function toAvatarProfile(p: CharacterProfile): AvatarProfile {
  return { skin: p.skin, hair: p.hair, outfit: p.outfit, pants: p.pants, beard: p.beard, faceDataUrl: p.faceDataUrl };
}

type Value = {
  profile: CharacterProfile;
  hydrated: boolean;
  systemReduceMotion: boolean;
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
  const value = useMemo(() => ({ profile, hydrated, systemReduceMotion, update, save, removePhoto, reset }), [profile, hydrated, systemReduceMotion, update, save, removePhoto, reset]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Lets a preview render the companion with an unsaved draft profile. */
export const CharacterContextOverride = Context.Provider;

export function useCharacter() {
  const v = useContext(Context);
  if (!v) throw new Error("CharacterProvider is required");
  return v;
}
