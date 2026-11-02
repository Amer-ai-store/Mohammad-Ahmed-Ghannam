// "القوائم ووضع العائلة" — smart shopping lists; family lists are shared by an invite code.
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ListChecks, Users } from "lucide-react-native";
import { Shell } from "../../components/Shell";
import { Txt } from "../../components/ui";
import { AccountGate } from "../../components/AccountKit";
import { Card, Checkbox, Chip, CTA, ErrorBlock, Field, LoadingBlock, SectionHeader } from "../../components/design/kit";
import { useMoney } from "../../components/smart/Bits";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store";
import { useRemote } from "../../lib/useRemote";
import type { ShoppingList } from "../../lib/smart";
import { useTheme } from "../../lib/theme";

export default function ListsScreen() {
  return <Shell title="القوائم ووضع العائلة" subtitle="خطط مشترياتك وشاركها مع أفراد العائلة"><AccountGate><Body /></AccountGate></Shell>;
}
function Body() {
  const { colors: t } = useTheme();
  const money = useMoney();
  const { notify } = useStore();
  const { data, setData, loading, error, reload } = useRemote<{ lists: ShoppingList[] }>("/lists", { auth: true });
  const [name, setName] = useState(""); const [budget, setBudget] = useState(""); const [family, setFamily] = useState(true);
  const [code, setCode] = useState(""); const [busy, setBusy] = useState("");
  async function create() {
    if (!name.trim()) { notify("اكتب اسم القائمة"); return; }
    setBusy("create");
    try { const r = await api.post<{ list: ShoppingList }>("/lists", { name: name.trim(), budget: budget ? Number(budget) : null, family }); setData((d) => ({ lists: [r.list, ...(d?.lists || [])] })); setName(""); setBudget(""); router.push(`/lists/${r.list.id}`); }
    catch (e) { notify(e instanceof Error ? e.message : "تعذّر الإنشاء"); } finally { setBusy(""); }
  }
  async function join() {
    setBusy("join");
    try { const r = await api.post<{ list: ShoppingList }>("/lists/join", { code }); notify(`انضممت إلى «${r.list.name}»`); setCode(""); reload(); router.push(`/lists/${r.list.id}`); }
    catch (e) { notify(e instanceof Error ? e.message : "رمز غير صحيح"); } finally { setBusy(""); }
  }
  return (
    <View style={{ gap: 14 }}>
      {loading && !data ? <LoadingBlock /> : !data ? <ErrorBlock message={error || "تعذّر التحميل"} onRetry={reload} /> : data.lists.map((l) => {
        const total = l.items.reduce((a, i) => a + (i.lineTotal || 0), 0), done = l.items.filter((i) => i.done).length;
        return (
          <Pressable key={l.id} testID={`list-${l.id}`} accessibilityRole="button" onPress={() => router.push(`/lists/${l.id}`)}>
            <Card style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
              {l.family ? <Users size={30} color={t.purple} /> : <ListChecks size={30} color={t.orange} />}
              <View style={{ flex: 1, alignItems: "flex-end", gap: 3 }}>
                <Txt weight="bold" style={{ fontSize: 17, color: t.title }}>{l.name}</Txt>
                <Txt style={{ color: t.muted, fontSize: 13 }}>{l.items.length} صنف · تم {done} · {money(total)}{l.budget ? ` من ${money(l.budget)}` : ""}</Txt>
              </View>
              {l.family ? <Chip label={`${l.members.length} أفراد`} tone="info" /> : null}
              {l.budget && total > l.budget ? <Chip label="تجاوز الميزانية" tone="warn" /> : null}
            </Card>
          </Pressable>
        );
      })}
      <Card>
        <SectionHeader title="قائمة جديدة" />
        <Field label="اسم القائمة" placeholder="مثلًا: مشتريات الأسبوع" value={name} onChangeText={setName} testID="list-name" />
        <Field label="الميزانية (اختياري)" placeholder="الميزانية (اختياري)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" style={{ marginTop: 8 }} />
        <View style={{ marginTop: 6 }}><Checkbox checked={family} onChange={setFamily} label="قائمة عائلية مشتركة (رمز دعوة)" /></View>
        <CTA title="إنشاء القائمة" busy={busy === "create"} onPress={() => void create()} testID="list-create" />
      </Card>
      <Card>
        <SectionHeader title="انضم لقائمة عائلية" icon={Users} />
        <Field label="رمز الدعوة" placeholder="أدخل رمز الدعوة (8 أحرف)" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" testID="list-code" />
        <CTA title="انضمام" tone="soft" busy={busy === "join"} disabled={code.trim().length < 4} onPress={() => void join()} style={{ marginTop: 8 }} />
      </Card>
    </View>
  );
}
