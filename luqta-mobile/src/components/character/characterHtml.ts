// Pure HTML builders shared by the native WebView, the web iframe and the
// browser tests. No React Native imports here so Node can run it directly.
import { AVATAR_JS, GLTF_JS, THREE_JS, VIEWER_JS } from "./webEngines.generated.ts";
import { CHARACTER_MODEL_DATA_URL } from "./characterModel.generated.ts";

export type AvatarAction =
  | "idle" | "walk" | "run" | "jump" | "sleep" | "wake" | "cart" | "come" | "wave"
  | "point" | "thumbs" | "think" | "crossed" | "listen" | "sit" | "stop";

export const AVATAR_ACTIONS: AvatarAction[] = [
  "idle", "walk", "run", "jump", "sleep", "wake", "cart", "come", "wave",
  "point", "thumbs", "think", "crossed", "listen", "sit", "stop",
];

export type AvatarProfile = {
  skin?: string; hair?: string; outfit?: string; pants?: string; boots?: string;
  beard?: boolean; faceDataUrl?: string;
};

const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(LINE_SEPARATORS, " ");

function page(body: string, init: unknown, engine: string, extra = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src data: blob:${extra ? " https:" : ""};">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}canvas{display:block;width:100%;height:100%;touch-action:none}</style></head>
<body>${body}<script>window.__LUQTA_INIT__=${safeJson(init)};</script><script>${THREE_JS}</script>${extra}<script>${engine}</script></body></html>`;
}

/** Only https GLB/GLTF URLs are accepted for a dashboard-provided character model. */
export function safeModelUrl(url: unknown): string | undefined {
  return typeof url === "string" && /^https:\/\/[^\s"'<>]+\.(glb|gltf)(\?[^\s"'<>]*)?$/i.test(url) ? url : undefined;
}

export function avatarHtml(init: { action?: AvatarAction; profile?: AvatarProfile; reduceMotion?: boolean; sound?: boolean; modelUrl?: string } = {}) {
  const clean = { ...init, modelUrl: safeModelUrl(init.modelUrl) };
  const extra = `<script>${GLTF_JS}</script><script>window.__LUQTA_MODEL__=${JSON.stringify(CHARACTER_MODEL_DATA_URL)};</script>`;
  return page('<canvas id="stage" aria-hidden="true"></canvas>', clean, AVATAR_JS, extra);
}

export type ViewerModel = "chair" | "headphones" | "box";
export function viewerHtml(init: { model: ViewerModel; color?: string; dimensions?: { w: number; d: number; h: number }; imageDataUrl?: string }) {
  return page('<canvas id="stage" aria-label="عرض ثلاثي الأبعاد"></canvas>', init, VIEWER_JS);
}
