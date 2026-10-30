import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ArrowUp, RotateCcw, Sparkles } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { Shell } from "../components/Shell";
import { ProductGrid } from "../components/ProductGrid";
import { Txt } from "../components/ui";
import { useStore } from "../lib/store";
import { recommendProducts } from "../lib/recommendations";
import { askAssistant, checkAssistant } from "../lib/assistant";
import { Palette, useTheme, useThemedStyles } from "../lib/theme";

type Message = {
  role: "user" | "assistant";
  content: string;
  productIds?: string[];
};
const welcome: Message = {
  role: "assistant",
  content:
    "أهلًا! أخبرني ما الذي تبحث عنه وكم ميزانيتك. هدية، شيء لمنزلك، أو إضافة لمكتبك؟ لنجد لُقطتك المناسبة.",
};
export default function Assistant() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <AssistantContent key={q || "new"} initialPrompt={q || ""} />;
}
function AssistantContent({ initialPrompt }: { initialPrompt: string }) {
  const { colors: t } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { products, settings } = useStore();
  const prompts = [
    `هدية بميزانية 250 ${settings.currency}`,
    "سماعات بميزانية 400",
    "إضافات لمكتبي تحت 300",
    "العناية بالبشرة",
  ];
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState(initialPrompt);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { width } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    let active = true;
    checkAssistant().then((value) => {
      if (active) {
        setReady(value);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const recheck = async () => {
    setChecking(true);
    const available = await checkAssistant();
    setReady(available);
    setConnected(false);
    setChecking(false);
  };
  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy || checking) return;
    setInput("");
    setError("");
    setBusy(true);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((old) => [...old, { role: "user", content: message }]);
    try {
      const result = ready
        ? await askAssistant(message, history)
        : recommendProducts(message, products.filter((p) => !p.variantOf && (p.stock === undefined || p.stock > 0)), settings.currency);
      if (ready) setConnected(true);
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: result.message,
          productIds: result.productIds
            .filter((id: string) => products.some((p) => p.id === id && !p.variantOf))
            .slice(0, 3),
        },
      ]);
    } catch (e) {
      setConnected(false);
      setMessages((old) => old.slice(0, -1));
      setError(
        e instanceof Error ? e.message : "تعذّر الاتصال بالمساعد. حاول مجددًا.",
      );
      setInput(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title="اختيارك أسهل، مع مساعدك"
      subtitle="من أول فكرة إلى اللُقطة المناسبة. أخبرنا عمّا تحتاجه."
    >
      <View style={s.statusRow}>
        <View style={s.status}>
          <View
            style={[s.dot, { backgroundColor: ready ? t.green : t.orange }]}
          />
          <Txt
            weight="bold"
            style={{ color: ready ? t.green : t.muted, fontSize: 11 }}
          >
            {checking
              ? "التحقق من الاتصال..."
              : connected
                ? "مساعد OpenAI متصل"
                : ready
                  ? "مساعد OpenAI مُعدّ"
                  : "توصيات محلية"}
          </Txt>
        </View>
        <View style={{ flexDirection: "row-reverse", gap: 15 }}>
          <Pressable
            disabled={busy || checking}
            accessibilityRole="button"
            onPress={recheck}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Txt style={{ color: t.orange, fontSize: 11 }}>إعادة التحقق</Txt>
          </Pressable>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="بدء محادثة جديدة"
            onPress={() => {
              setMessages([welcome]);
              setError("");
            }}
            style={s.reset}
          >
            <RotateCcw size={14} color={t.muted} />
            <Txt style={{ color: t.muted, fontSize: 12 }}>محادثة جديدة</Txt>
          </Pressable>
        </View>
      </View>
      {!checking && !ready ? (
        <View style={s.notice}>
          <Txt style={{ color: t.muted, fontSize: 12, lineHeight: 23 }}>
            الاتصال بالذكاء الاصطناعي غير مفعّل حاليًا. يمكنك تجربة اقتراحات
            مبنية على الكلمات والميزانية من منتجات المتجر.
          </Txt>
        </View>
      ) : null}
      <View style={s.chat}>
        <View style={s.chatHead}>
          <View style={s.assistantIcon}>
            <Sparkles color={t.orange} size={26} />
          </View>
          <View>
            <Txt weight="extra" style={{ fontSize: 20 }}>
              مساعد لُقطة
            </Txt>
            <Txt style={{ color: t.muted, fontSize: 11, marginTop: 4 }}>
              لأن أفضل اختيار، هو ما يناسبك.
            </Txt>
          </View>
        </View>
        {messages.map((message, index) => (
          <View key={index} style={{ marginBottom: 20 }}>
            <View
              style={[s.bubble, message.role === "user" ? s.user : s.assistant]}
            >
              <Txt
                style={{
                  color: message.role === "user" ? t.onAccent : t.ink,
                  fontSize: 15,
                  lineHeight: 27,
                }}
              >
                {message.content}
              </Txt>
            </View>
            {message.productIds?.length ? (
              <View style={{ marginTop: 15 }}>
                <ProductGrid
                  items={message.productIds
                    .map((id) => products.find((p) => p.id === id)!)
                    .filter(Boolean)}
                />
              </View>
            ) : null}
          </View>
        ))}
        {busy ? (
          <View style={s.thinking}>
            <ActivityIndicator size="small" color={t.orange} />
            <Txt style={{ color: t.muted, fontSize: 12 }}>
              أبحث عن اختيار يناسبك...
            </Txt>
          </View>
        ) : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={s.error}>
            <Txt style={{ color: t.danger, lineHeight: 24, fontSize: 13 }}>
              {error}
            </Txt>
            <Pressable accessibilityRole="button" onPress={() => send(input)}>
              <Txt
                weight="bold"
                style={{ color: t.orange, fontSize: 12, marginTop: 6 }}
              >
                إعادة المحاولة
              </Txt>
            </Pressable>
          </View>
        ) : null}
        {messages.length === 1 ? (
          <View style={s.prompts}>
            {prompts.map((prompt) => (
              <Pressable
                accessibilityRole="button"
                disabled={checking}
                key={prompt}
                onPress={() => send(prompt)}
                style={s.prompt}
              >
                <Txt style={{ fontSize: 12, color: t.muted }}>{prompt}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={s.inputWrap}>
          <TextInput
            ref={inputRef}
            accessibilityLabel="اكتب طلبك لمساعد التسوق"
            value={input}
            onChangeText={setInput}
            placeholder="أبحث عن هدية لشخص يحب القهوة..."
            placeholderTextColor={t.muted}
            maxLength={1200}
            editable={!busy}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            style={[s.input, { fontSize: width < 500 ? 13 : 15 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إرسال إلى المساعد"
            disabled={busy || !input.trim() || checking}
            onPress={() => send(input)}
            style={[
              s.send,
              busy || !input.trim() || checking ? { opacity: 0.4 } : null,
            ]}
          >
            <ArrowUp size={20} color={t.onAccent} />
          </Pressable>
        </View>
        <Txt
          style={{
            color: t.muted,
            fontSize: 10,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          الاقتراحات من كتالوج المتجر. راجع تفاصيل المنتج قبل اختياره.
        </Txt>
      </View>
      <View style={s.tip}>
        <Sparkles color={t.orange} size={18} />
        <Txt
          style={{ flex: 1, color: t.muted, fontSize: 12, lineHeight: 23 }}
        >
          لنتيجة أقرب لذوقك: حدّد لمن تتسوق، المناسبة، والميزانية.
        </Txt>
      </View>
    </Shell>
  );
}
const makeStyles = (t: Palette) => StyleSheet.create({
  statusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  status: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: t.secondary,
  },
  dot: { width: 6, height: 6, borderRadius: 4 },
  reset: { flexDirection: "row-reverse", gap: 6, alignItems: "center", minHeight: 44 },
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: t.orangeSoft,
  },
  chat: {
    backgroundColor: t.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.line,
    padding: 22,
    minHeight: 450,
  },
  chatHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingBottom: 22,
    marginBottom: 24,
  },
  assistantIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: t.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "93%",
    borderRadius: 15,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  user: {
    backgroundColor: t.orange,
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  assistant: {
    backgroundColor: t.secondary,
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  thinking: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  error: {
    backgroundColor: t.orangeSoft,
    padding: 15,
    borderRadius: 12,
    marginBottom: 17,
  },
  prompts: {
    flexDirection: "row-reverse",
    gap: 9,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  prompt: {
    borderWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 11,
  },
  inputWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: t.secondary,
    padding: 8,
    paddingRight: 16,
    borderRadius: 15,
    gap: 10,
    marginTop: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    color: t.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.orange,
  },
  tip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    paddingHorizontal: 7,
  },
});
