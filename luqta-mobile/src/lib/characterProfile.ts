// Pure character profile helpers (no React Native imports — unit tested).
import type { AvatarProfile } from "../components/character/characterHtml.ts";

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
  /** WP-16 optional hologram look */
  hologram: boolean;
  consentAt?: string;
  createdAt?: string;
};

export const outfitSwatches = ["#141414", "#C9252B", "#F25A5E", "#5B2BE0"] as const;
export const DEFAULT_CHARACTER: CharacterProfile = {
  skin: "#E0A27C", hair: "#3F281B", outfit: "#141414", pants: "#C4161B", beard: true,
  scale: 0.25, reduceMotion: false, sound: true, enabled3d: true, hologram: false,
};
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
    reduceMotion: r.reduceMotion === true, sound: r.sound !== false, enabled3d: r.enabled3d !== false, hologram: r.hologram === true,
    consentAt: typeof r.consentAt === "string" ? r.consentAt : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
  };
}

export function toAvatarProfile(p: CharacterProfile): AvatarProfile {
  return { skin: p.skin, hair: p.hair, outfit: p.outfit, pants: p.pants, beard: p.beard, faceDataUrl: p.faceDataUrl, hologram: p.hologram };
}

