// G16 — search autocomplete (server), popular searches (anonymous counts) and recent
// searches (this device only).
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Clock, Flame, Search, X } from "lucide-react-native";
import { Txt } from "../ui";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";
import { useSession } from "../../lib/session";
import { useTheme } from "../../lib/theme";

const KEY = "luqta-recent-searches";
export async function rememberSearch(q: string) {
  const v = q.trim(); if (v.length < 2) return;
  track("search");
  void api.post("/search/log", { q: v }).catch(() => {});
  try { const old: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]"); await AsyncStorage.setItem(KEY, JSON.stringify([v, ...old.filter((x) => x !== v)].slice(0, 8))); } catch { /* ignore */ }
}

export function SearchSuggestions({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  const { colors: t } = useTheme();
  const { configured } = useSession();
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  const [suggest, setSuggest] = useState<{ q: string; products: { id: string; name: string }[]; queries: string[] } | null>(null);
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => setRecent(JSON.parse(v || "[]"))).catch(() => {}); }, [query]);
  useEffect(() => { let a = true; if (!configured) return; api.get<{ queries: { query: string }[] }>("/search/popular").then((r) => { if (a) setPopular(r.queries.map((x) => x.query)); }).catch(() => {}); return () => { a = false; }; }, [configured]);
  useEffect(() => {
    let a = true; const q = query.trim();
    if (!configured || !q) return;
    const id = setTimeout(() => { api.get<{ products: { id: string; name: string }[]; queries: string[] }>(`/search/suggest?q=${encodeURIComponent(q)}`).then((r) => { if (a) setSuggest({ q, ...r }); }).catch(() => {}); }, 200);
    return () => { a = false; clearTimeout(id); };
  }, [query, configured]);
  const q = query.trim();
  const chip = (label: string, Icon: typeof Clock, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={`بحث: ${label}`} onPress={onPress} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
      <Icon size={14} color={t.muted} /><Txt style={{ color: t.ink, fontSize: 14 }}>{label}</Txt>
    </Pressable>
  );
  if (q) {
    const s = suggest && suggest.q === q ? suggest : null;
    if (!s || (!s.products.length && !s.queries.length)) return null;
    return (
      <View style={{ marginTop: 8, backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 6 }} testID="search-suggestions">
        {s.queries.map((x) => <Pressable key={`q-${x}`} accessibilityRole="button" onPress={() => onPick(x)} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10 }}><Search size={16} color={t.muted} /><Txt style={{ color: t.ink }}>{x}</Txt></Pressable>)}
        {s.products.map((p) => <Pressable key={p.id} accessibilityRole="button" onPress={() => { void rememberSearch(q); router.push(`/product/${p.id}`); }} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10 }}><Txt weight="bold" style={{ color: t.title }}>{p.name}</Txt></Pressable>)}
      </View>
    );
  }
  if (!recent.length && !popular.length) return null;
  return (
    <View style={{ marginTop: 8, gap: 8 }} testID="search-history">
      {recent.length ? (
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexDirection: "row-reverse" }}>{recent.map((r) => chip(r, Clock, () => onPick(r)))}</ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="مسح عمليات البحث الأخيرة" onPress={() => { setRecent([]); void AsyncStorage.removeItem(KEY).catch(() => {}); }} hitSlop={8}><X size={18} color={t.muted} /></Pressable>
        </View>
      ) : null}
      {popular.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexDirection: "row-reverse" }}>{popular.map((p) => chip(p, Flame, () => onPick(p)))}</ScrollView> : null}
    </View>
  );
}
