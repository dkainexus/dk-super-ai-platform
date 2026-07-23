import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { api, type VideoItem, type WalletInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Card, Muted, Screen } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, fonts, palettes } from "../../lib/theme";

// Home: wallet hero (balance + eye toggle + quick actions) and Training.

const HIDE_KEY = "dk_balance_hidden";

const ACTIONS = [
  { key: "my_reward", icon: "gift-outline", href: "/wallet/rewards" },
  { key: "transactions", icon: "receipt-outline", href: "/wallet/transactions" },
  { key: "withdraw", icon: "cash-outline", href: "/wallet" },
  { key: "requests", icon: "time-outline", href: "/wallet/requests" },
] as const;

export default function HomeScreen() {
  const { me, refresh } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [hidden, setHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(HIDE_KEY)
      .then((v) => setHidden(v === "1"))
      .catch(() => {});
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      SecureStore.setItemAsync(HIDE_KEY, h ? "0" : "1").catch(() => {});
      return !h;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [v, n, w] = await Promise.all([
        me?.modules.training ? api.videos() : Promise.resolve({ videos: [] }),
        me?.modules.notifications
          ? api.notifications()
          : Promise.resolve({ notifications: [], unread: 0 }),
        me?.modules.wallet ? api.wallet() : Promise.resolve(null),
      ]);
      setVideos(v.videos);
      setUnread(n.unread);
      setWallet(w);
    } catch {
      // keep whatever we had
    }
  }, [me?.modules.training, me?.modules.notifications, me?.modules.wallet]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  }, [refresh, load]);

  const completed = videos.filter((v) => v.completed).length;
  const progressPct = videos.length ? Math.round((completed / videos.length) * 100) : 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, gap: 18 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Hero: greeting + bell + balance + quick actions */}
        <LinearGradient
          colors={[palettes.mint.from, palettes.blue.to, palettes.violet.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBorder}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12 }}>{t("hello")}</Muted>
                <Text style={styles.hello}>{me?.owner.name ?? me?.owner.username ?? ""}</Text>
              </View>
              {me?.modules.notifications && (
                <Pressable
                  onPress={() => router.push("/(tabs)/notifications")}
                  style={styles.bellBtn}
                  hitSlop={8}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
                  {unread > 0 && (
                    <View style={styles.bellBadge}>
                      <Text style={styles.bellBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>

            {me?.modules.wallet && (
              <>
                <Muted style={styles.balanceLabel}>{t("wallet_balance")}</Muted>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceValue}>
                    {hidden ? "••••••" : (wallet?.balance ?? 0).toLocaleString()}
                    {!hidden && (
                      <Text style={styles.balanceCurrency}> {wallet?.currency ?? ""}</Text>
                    )}
                  </Text>
                  <Pressable onPress={toggleHidden} hitSlop={10} style={styles.eyeBtn}>
                    <Ionicons
                      name={hidden ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
                <View style={styles.actionRow}>
                  {ACTIONS.map((a) => (
                    <Pressable
                      key={a.key}
                      style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push(a.href)}
                    >
                      <Ionicons name={a.icon} size={21} color={colors.accent} />
                      <Text style={styles.actionLabel}>{t(a.key)}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        </LinearGradient>

        {/* Training */}
        {me?.modules.training && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>{t("training").toUpperCase()}</Text>
            <Pressable onPress={() => router.push("/(tabs)/training")}>
              <Card style={styles.trainingCard}>
                <LinearGradient
                  colors={[palettes.violet.from, palettes.violet.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.trainingIcon}
                >
                  <Ionicons name="play" size={19} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.trainingTitle}>{t("your_progress")}</Text>
                    <Text style={styles.trainingPct}>{progressPct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={[palettes.mint.from, palettes.mint.to]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${Math.max(progressPct, 2)}%` }]}
                    />
                  </View>
                  <Muted style={{ fontSize: 12 }}>
                    {t("videos_completed", { done: completed, total: videos.length })}
                  </Muted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Card>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBorder: { borderRadius: 22, padding: 1.5 },
  hero: { borderRadius: 20.5, backgroundColor: colors.surface, padding: 18 },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  hello: { color: colors.foreground, fontSize: 18, fontFamily: fonts.bold },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.extrabold },
  balanceLabel: { fontSize: 11, letterSpacing: 1.5, fontFamily: fonts.bold },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  balanceValue: {
    color: colors.accent,
    fontSize: 34,
    fontFamily: fonts.extrabold,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  balanceCurrency: { color: colors.muted, fontSize: 15, fontFamily: fonts.semibold },
  eyeBtn: { marginTop: 6 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: { color: colors.foreground, fontSize: 10, fontFamily: fonts.semibold },
  sectionTitle: { color: colors.muted, fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1.2 },
  trainingCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  trainingIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  trainingTitle: { color: colors.foreground, fontSize: 14, fontFamily: fonts.semibold },
  trainingPct: { color: colors.accent, fontSize: 14, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
});
