import React, { useEffect, useId, useMemo, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, Line, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { ROBOT_DEFAULTS, RobotAccessory, RobotMotion, RobotOutfit, useRobot } from "../lib/robot";
import { Txt } from "./ui";

// The mascot is drawn in a 120×150 box. Each moving part is its own small SVG inside an Animated.View, so motion
// runs on the native driver (transform/opacity only) and never re-renders the SVG.
const W = 120, H = 150;
const native = Platform.OS !== "web";
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  return `#${[n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}
const MOTION_LABEL: Record<RobotMotion, string> = { idle: "يقف مبتسمًا", wave: "يلوّح لك", walk: "يمشي", jump: "يقفز", come: "يقترب منك", stop: "متوقف", dance: "يرقص", sleep: "نائم", sad: "حزين", talk: "يتحدث" };

type Props = {
  size?: number; motion?: RobotMotion; message?: string; color?: string; outfit?: RobotOutfit; accessory?: RobotAccessory;
  face?: string | null; reduceMotion?: boolean; bubble?: "top" | "side" | "none"; onPress?: () => void; style?: ViewStyle; testID?: string;
};

export function Robot({ size = 120, motion = "idle", message, color, outfit, accessory, face, reduceMotion, bubble = "side", onPress, style, testID }: Props) {
  const { colors: t, isDark } = useTheme();
  const { t: tr } = useI18n();
  const robot = useRobot();
  const prefs = robot.prefs;
  const tint = color ?? prefs.color ?? ROBOT_DEFAULTS.color;
  const wear = outfit ?? prefs.outfit, extra = accessory ?? prefs.accessory, photo = face === undefined ? robot.face : face;
  const still = reduceMotion ?? robot.reduceMotion;
  const scale = size / H;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const bob = useState(() => new Animated.Value(0))[0], blink = useState(() => new Animated.Value(1))[0], glow = useState(() => new Animated.Value(0.6))[0];
  const armL = useState(() => new Animated.Value(0))[0], armR = useState(() => new Animated.Value(0))[0];
  const legL = useState(() => new Animated.Value(0))[0], legR = useState(() => new Animated.Value(0))[0];
  const x = useState(() => new Animated.Value(0))[0], y = useState(() => new Animated.Value(0))[0], grow = useState(() => new Animated.Value(1))[0], tilt = useState(() => new Animated.Value(0))[0];
  const mouth = useState(() => new Animated.Value(0))[0], zzz = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const all = [bob, blink, glow, armL, armR, legL, legR, x, y, grow, tilt, mouth, zzz];
    all.forEach((v) => v.stopAnimation());
    const set = (v: Animated.Value, to: number) => v.setValue(to);
    [bob, armL, armR, legL, legR, x, y, tilt, mouth, zzz].forEach((v) => set(v, 0)); set(grow, 1); set(blink, 1); set(glow, 0.7);
    if (motion === "stop") { set(armL, -150); set(armR, 150); return; }
    if (motion === "sad") { set(tilt, -7); set(armL, 8); set(armR, -8); }
    if (still) { if (motion === "wave") set(armR, -35); if (motion === "come") { set(armL, 30); set(armR, -30); } return; }
    const ease = Easing.inOut(Easing.sin);
    const tween = (v: Animated.Value, to: number, duration: number, easing = ease) => Animated.timing(v, { toValue: to, duration, easing, useNativeDriver: native });
    const loop = (animation: Animated.CompositeAnimation) => Animated.loop(animation);
    const running: Animated.CompositeAnimation[] = [];
    const start = (a: Animated.CompositeAnimation) => { running.push(a); a.start(); };
    const speed = motion === "walk" || motion === "dance" ? 0.5 : motion === "sleep" ? 2 : 1;
    if (motion !== "sad") start(loop(Animated.sequence([tween(bob, 1, 800 * speed), tween(bob, 0, 800 * speed)])));
    if (motion !== "sleep") start(loop(Animated.sequence([Animated.delay(2600), tween(blink, 0.1, 80), tween(blink, 1, 120), Animated.delay(900), tween(blink, 0.1, 70), tween(blink, 1, 110)])));
    start(loop(Animated.sequence([tween(glow, 1, 700), tween(glow, 0.35, 700)])));
    if (motion === "idle" || motion === "talk") start(loop(Animated.sequence([tween(armR, -10, 1200), tween(armR, 4, 1200)])));
    if (motion === "wave") start(loop(Animated.sequence([tween(armR, -45, 220), tween(armR, -10, 220)])));
    if (motion === "walk") {
      start(loop(Animated.sequence([tween(x, 14, 900), tween(x, -14, 1800), tween(x, 0, 900)])));
      start(loop(Animated.sequence([tween(legL, -5, 220), tween(legL, 0, 220)])));
      start(loop(Animated.sequence([Animated.delay(220), tween(legR, -5, 220), tween(legR, 0, 220)])));
      start(loop(Animated.sequence([tween(armL, 14, 440), tween(armL, -14, 440)])));
      start(loop(Animated.sequence([tween(armR, -14, 440), tween(armR, 14, 440)])));
    }
    if (motion === "jump") start(loop(Animated.sequence([tween(y, -26, 260, Easing.out(Easing.quad)), tween(y, 0, 380, Easing.bounce), Animated.delay(450)])));
    if (motion === "jump") start(loop(Animated.sequence([tween(armL, -120, 260), tween(armL, 0, 380), Animated.delay(450)])));
    if (motion === "jump") start(loop(Animated.sequence([tween(armR, 120, 260), tween(armR, 0, 380), Animated.delay(450)])));
    if (motion === "come") {
      start(Animated.spring(grow, { toValue: 1.14, friction: 5, useNativeDriver: native }));
      start(loop(Animated.sequence([tween(armL, 40, 380), tween(armL, 20, 380)])));
      start(loop(Animated.sequence([tween(armR, -40, 380), tween(armR, -20, 380)])));
    }
    if (motion === "dance") {
      start(loop(Animated.sequence([tween(tilt, 8, 260), tween(tilt, -8, 520), tween(tilt, 0, 260)])));
      start(loop(Animated.sequence([tween(armL, -110, 260), tween(armL, 10, 260)])));
      start(loop(Animated.sequence([tween(armR, 10, 260), tween(armR, 110, 260)])));
    }
    if (motion === "talk") start(loop(Animated.sequence([tween(mouth, 1, 140), tween(mouth, 0.2, 160)])));
    if (motion === "sleep") start(loop(Animated.sequence([tween(zzz, 1, 1600, Easing.linear), Animated.delay(200)])));
    return () => running.forEach((a) => a.stop());
  }, [motion, still, bob, blink, glow, armL, armR, legL, legR, x, y, grow, tilt, mouth, zzz]);

  const body = tint, light = shade(tint, 0.35), dark = shade(tint, -0.28), visor = isDark ? "#0E0B1F" : "#1E1A3A", eye = "#7CF6FF";
  const asleep = motion === "sleep", sad = motion === "sad";
  const layer = (style: object) => [StyleSheet.absoluteFill, style];
  const px = (v: number) => v * scale;
  const rot = (v: Animated.Value) => v.interpolate({ inputRange: [-180, 180], outputRange: ["-180deg", "180deg"] });
  const outfitBehind = useMemo(() => wear === "cape" ? <Path d="M34 76 Q60 70 86 76 L98 130 Q60 140 22 130 Z" fill={shade(t.orange, -0.1)} /> : wear === "hoodie" ? <Path d="M18 52 Q20 8 60 8 Q100 8 102 52 L96 70 L24 70 Z" fill={dark} /> : null, [wear, t.orange, dark]);

  const robotView = (
    <Animated.View style={{ width: px(W), height: px(H), transform: [{ translateX: x }, { translateY: Animated.add(y, bob.interpolate({ inputRange: [0, 1], outputRange: [0, -px(4)] })) }, { scale: grow }, { rotate: rot(tilt) }] }}>
      <Animated.View style={layer({ opacity: y.interpolate({ inputRange: [-26, 0], outputRange: [0.45, 1] }) })} pointerEvents="none">
        <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}><Ellipse cx={60} cy={144} rx={30} ry={5} fill={t.shadow} opacity={0.18} /></Svg>
      </Animated.View>
      {[legL, legR].map((leg, i) => (
        <Animated.View key={i} style={layer({ transform: [{ translateY: leg }] })} pointerEvents="none">
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}>
            <Rect x={i ? 64 : 44} y={114} width={12} height={22} rx={6} fill={dark} />
            <Ellipse cx={i ? 71 : 49} cy={137} rx={9} ry={5} fill={shade(tint, -0.45)} />
          </Svg>
        </Animated.View>
      ))}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id={`b${uid}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={light} /><Stop offset="1" stopColor={body} /></LinearGradient>
            <ClipPath id={`v${uid}`}><Rect x={32} y={30} width={56} height={34} rx={15} /></ClipPath>
          </Defs>
          {outfitBehind}
          <Rect x={30} y={72} width={60} height={50} rx={20} fill={`url(#b${uid})`} />
          <Rect x={43} y={84} width={34} height={24} rx={9} fill="#FFFFFF" opacity={0.92} />
          <Path d="M60 103 C52 97 49 92 53 89 C56 87 59 89 60 91 C61 89 64 87 67 89 C71 92 68 97 60 103 Z" fill={t.orange} />
          {wear === "hoodie" ? <Rect x={44} y={110} width={32} height={8} rx={4} fill={dark} opacity={0.6} /> : null}
          <Rect x={52} y={64} width={16} height={10} rx={4} fill={dark} />
          {extra !== "headphones" ? <><Circle cx={22} cy={47} r={7} fill={dark} /><Circle cx={98} cy={47} r={7} fill={dark} /></> : null}
          <Rect x={22} y={18} width={76} height={56} rx={24} fill={`url(#b${uid})`} />
          <Rect x={32} y={30} width={56} height={34} rx={15} fill={visor} />
          {photo ? <SvgImage href={{ uri: photo }} x={32} y={30} width={56} height={34} preserveAspectRatio="xMidYMid slice" clipPath={`url(#v${uid})`} opacity={0.92} /> : null}
          {photo ? <Rect x={32} y={30} width={56} height={34} rx={15} fill="none" stroke={eye} strokeWidth={1.5} opacity={0.7} /> : null}
          <Circle cx={36} cy={60} r={4} fill="#FF8FB1" opacity={photo ? 0 : 0.55} />
          <Circle cx={84} cy={60} r={4} fill="#FF8FB1" opacity={photo ? 0 : 0.55} />
          <Line x1={60} y1={18} x2={60} y2={8} stroke={dark} strokeWidth={3} strokeLinecap="round" />
          {wear === "scarf" ? <Path d="M36 70 Q60 80 84 70 L84 78 Q60 88 36 78 Z M70 78 L78 96 L68 94 Z" fill={t.orange} /> : null}
          {wear === "bowtie" ? <><Polygon points="60,73 47,67 47,79" fill={t.orange} /><Polygon points="60,73 73,67 73,79" fill={t.orange} /><Circle cx={60} cy={73} r={3} fill={shade(t.orange, -0.3)} /></> : null}
          {extra === "cap" ? <><Path d="M28 30 Q30 6 60 6 Q90 6 92 30 Z" fill={t.primary} /><Rect x={60} y={26} width={42} height={7} rx={3.5} fill={shade(t.primary, -0.25)} /></> : null}
          {extra === "crown" ? <Polygon points="38,22 44,6 52,18 60,2 68,18 76,6 82,22" fill="#F7C531" stroke="#E0A800" strokeWidth={1.5} /> : null}
          {extra === "headphones" ? <><Path d="M20 46 Q20 4 60 4 Q100 4 100 46" fill="none" stroke={t.primary} strokeWidth={6} strokeLinecap="round" /><Rect x={12} y={36} width={14} height={24} rx={7} fill={t.primary} /><Rect x={94} y={36} width={14} height={24} rx={7} fill={t.primary} /></> : null}
          {extra === "flower" ? <G>{[0, 72, 144, 216, 288].map((a) => <Circle key={a} cx={92 + 6 * Math.cos(a * Math.PI / 180)} cy={22 + 6 * Math.sin(a * Math.PI / 180)} r={5} fill="#FF8FB1" />)}<Circle cx={92} cy={22} r={3.5} fill="#F7C531" /></G> : null}
        </Svg>
      </View>
      <Animated.View style={layer({ opacity: glow })} pointerEvents="none">
        <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}><Circle cx={60} cy={6} r={8} fill={t.orange} opacity={0.35} /><Circle cx={60} cy={6} r={5} fill={t.orange} /></Svg>
      </Animated.View>
      {!photo ? (
        <Animated.View style={layer({ transform: [{ scaleY: blink }], transformOrigin: `50% ${(46 / H) * 100}%` })} pointerEvents="none">
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}>
            {asleep ? <><Path d="M43 47 Q49 51 55 47" stroke={eye} strokeWidth={2.5} fill="none" strokeLinecap="round" /><Path d="M65 47 Q71 51 77 47" stroke={eye} strokeWidth={2.5} fill="none" strokeLinecap="round" /></>
              : <><Rect x={44} y={sad ? 42 : 38} width={11} height={sad ? 9 : 14} rx={5.5} fill={eye} /><Rect x={65} y={sad ? 42 : 38} width={11} height={sad ? 9 : 14} rx={5.5} fill={eye} /><Circle cx={51.5} cy={sad ? 45 : 42} r={2} fill="#FFFFFF" /><Circle cx={72.5} cy={sad ? 45 : 42} r={2} fill="#FFFFFF" /></>}
            {extra === "glasses" ? <><Circle cx={49.5} cy={45} r={10} fill="none" stroke="#F7C531" strokeWidth={2.2} /><Circle cx={70.5} cy={45} r={10} fill="none" stroke="#F7C531" strokeWidth={2.2} /><Line x1={59.5} y1={45} x2={60.5} y2={45} stroke="#F7C531" strokeWidth={2.2} /></> : null}
          </Svg>
        </Animated.View>
      ) : null}
      {!photo ? (
        <Animated.View style={layer({ transform: [{ scaleY: mouth.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }], transformOrigin: `50% ${(57 / H) * 100}%` })} pointerEvents="none">
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}>
            <Path d={sad ? "M52 59 Q60 54 68 59" : "M51 56 Q60 62 69 56"} stroke={eye} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ) : null}
      {[{ v: armL, x: 14, origin: "19% 52%" }, { v: armR, x: 92, origin: "81% 52%" }].map((arm, i) => (
        <Animated.View key={i} style={layer({ transform: [{ rotate: rot(arm.v) }], transformOrigin: arm.origin })} pointerEvents="none">
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}>
            <Rect x={arm.x} y={76} width={14} height={32} rx={7} fill={dark} />
            <Circle cx={arm.x + 7} cy={110} r={7.5} fill={light} />
          </Svg>
        </Animated.View>
      ))}
      {asleep ? (
        <Animated.View style={layer({ opacity: zzz.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: zzz.interpolate({ inputRange: [0, 1], outputRange: [0, -px(18)] }) }] })} pointerEvents="none">
          <Svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`}><Path d="M92 16 h10 l-10 12 h10 M104 4 h7 l-7 8 h7" stroke={t.primary} strokeWidth={2.4} fill="none" strokeLinejoin="round" /></Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
  const label = `${prefs.name || "لُقطي"} ${tr(MOTION_LABEL[motion])}`;
  const bubbleView = message && bubble !== "none" ? (
    <View style={[styles.bubble, { backgroundColor: t.paper, borderColor: t.line, maxWidth: Math.max(140, size * 1.5) }]} accessibilityLiveRegion="polite">
      <Txt weight="bold" style={{ fontSize: 13, lineHeight: 20 }}>{message}</Txt>
    </View>
  ) : null;
  return (
    <View style={[{ flexDirection: bubble === "top" ? "column" : "row-reverse", alignItems: "center", gap: 8 }, style]} testID={testID}>
      {bubble === "top" ? bubbleView : null}
      <Pressable accessibilityRole={onPress ? "button" : "image"} accessibilityLabel={label} onPress={onPress} disabled={!onPress} hitSlop={8}>
        {robotView}
      </Pressable>
      {bubble === "side" ? bubbleView : null}
    </View>
  );
}

// The robot used across the app: follows the shopper's saved motion, reacts to events and speaks when tapped.
export function Mascot({ size = 84, message, motion, bubble = "side", style, interactive = true }: { size?: number; message?: string; motion?: RobotMotion; bubble?: "top" | "side" | "none"; style?: ViewStyle; interactive?: boolean }) {
  const robot = useRobot();
  const { t } = useI18n();
  const reaction = robot.reaction;
  const current: RobotMotion = reaction?.motion ?? (robot.speaking ? "talk" : motion ?? (robot.prefs.motion === "walk" || robot.prefs.motion === "dance" ? "idle" : robot.prefs.motion));
  const text = reaction?.message || message;
  const greet = () => {
    const lines = ["أهلًا! أنا لُقطي 🤖", "اضغط الميكروفون وقل لي شو بدك", "عندي عروض حلوة اليوم!", "جرّب «جهز لي سلة بـ ٢٠ دينار»"];
    const line = t(lines[Math.floor(Math.random() * lines.length)]);
    robot.play(["jump", "dance", "wave", "come"][Math.floor(Math.random() * 4)] as RobotMotion, line);
    robot.speak(line);
  };
  return <Robot size={size * robot.prefs.size} motion={current} message={text ? t(text) : undefined} bubble={bubble} onPress={interactive ? greet : undefined} style={style} testID="mascot" />;
}

const styles = StyleSheet.create({
  bubble: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, shadowColor: "#3B2A8A", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});
