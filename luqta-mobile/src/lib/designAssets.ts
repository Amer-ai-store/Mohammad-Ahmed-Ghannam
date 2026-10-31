// Bitmaps cut from the Amer AI Store | لُقطة reference designs (tools/extract_assets.py)
// plus the original bundled product photos. Keys are stable ids used by screens & data.
/* eslint-disable @typescript-eslint/no-require-imports */
export const designAssets = {
  logoMark: require("../../assets/design/logo-mark.png"),
  catFood: require("../../assets/design/cat-food.png"),
  catElectronics: require("../../assets/design/cat-electronics.png"),
  catFashion: require("../../assets/design/cat-fashion.png"),
  catHome: require("../../assets/design/cat-home.png"),
  exGrocery: require("../../assets/design/ex-grocery.png"),
  exElectronics: require("../../assets/design/ex-electronics.png"),
  exFashion: require("../../assets/design/ex-fashion.png"),
  exHome: require("../../assets/design/ex-home.png"),
  exBeauty: require("../../assets/design/ex-beauty.png"),
  exSports: require("../../assets/design/ex-sports.png"),
  camera3d: require("../../assets/design/camera-3d.png"),
};

// 2D poster frames of the companion, used only when WebGL is unavailable or the
// user turns 3D off. The live companion is the rigged 3D model (web-engines/avatar.js).
export const posePosters = {
  walk: require("../../assets/design/pose-walk.png"),
  cart: require("../../assets/design/pose-cart.png"),
  thumbs: require("../../assets/design/pose-thumbs.png"),
  crossed: require("../../assets/design/pose-crossed.png"),
  idle: require("../../assets/design/pose-stand.png"),
  point: require("../../assets/design/pose-point.png"),
  think: require("../../assets/design/pose-think.png"),
  run: require("../../assets/design/pose-run.png"),
  sit: require("../../assets/design/pose-sit.png"),
  sleep: require("../../assets/design/pose-sleep.png"),
  listen: require("../../assets/design/pose-listen.png"),
  jump: require("../../assets/design/pose-jump.png"),
} as const;

export const productImages: Record<string, ReturnType<typeof require>> = {
  rice: require("../../assets/design/p-rice.png"),
  milk: require("../../assets/design/p-milk.png"),
  banana: require("../../assets/design/p-banana.png"),
  headphones: require("../../assets/design/p-headphones.png"),
  "headphones-2": require("../../assets/design/p-headphones-2.png"),
  "headphones-3": require("../../assets/design/p-headphones-3.png"),
  "headphones-4": require("../../assets/design/p-headphones-4.png"),
  armchair: require("../../assets/design/p-chair.png"),
  speaker: require("../../assets/products/speaker.jpg"),
  keyboard: require("../../assets/products/keyboard.jpg"),
  lamp: require("../../assets/products/lamp.jpg"),
  mug: require("../../assets/products/mug.jpg"),
  sneakers: require("../../assets/products/sneakers.jpg"),
  bag: require("../../assets/products/bag.jpg"),
  watch: require("../../assets/products/watch.jpg"),
  serum: require("../../assets/products/serum.jpg"),
  fragrance: require("../../assets/products/fragrance.jpg"),
  diffuser: require("../../assets/products/diffuser.jpg"),
};
