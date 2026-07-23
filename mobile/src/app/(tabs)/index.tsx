import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type VideoItem, type WalletInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Card, CoinIcon, Muted, Tag, Screen } from "../../components/ui";
import { colors, palettes } from "../../lib/theme";

// Home: wallet hero (balance + quick actions), Training progress, My Account.

const ACTIONS = [
  { key: "rewards", label: "My Reward", icon: "gift-outline", href: "/wallet/rewards" },
  { key: "transactions", label: "Transactions", icon: "receipt-outline", href: "/wallet/transactions" },
  { key: "withdraw", label: "Withdraw", icon: "cash-outline", href: "/wallet" },
  { key: "requests", label: "Requests", icon: "time-outline", href: "/wallet/requests" },
] as const;

// Placeholder list until account submission is wired to the CMS.
const EXAMPLE_ACCOUNTS = [
  { id: "1", name: "@sunny_bkk", platform: "TikTok", emoji: "🎵", status: "ACTIVE", color: colors.success },
  { id: "2", name: "@mike.trader", platform: "Facebook", emoji: "📘", status: "PENDING", color: colors.warning },
  { id: "3", name: "@nan_2024", platform: "Instagram", emoji: "📸", status: "REVIEW", color: colors.accentStrong },
];

export default function HomeScreen() {
  const { me, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
                <Muted style={{ fontSize: 12 }}>Hello,</Muted>
                <Text style={styles.hello}>{me?.owner.name ?? me?.owner.username ?? ""}</Text>
              </View>
              {me?.modules.notifications && (
                <Pressable
                  onPress={() => router.push("/(tabs)/notifications")}
                  style={styles.bellBtn}
                  hitSlop={8}
                >
                  <Ionicons name="notifications-outline" size={21} color={colors.foreground} />
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
                <Muted style={styles.balanceLabel}>WALLET BALANCE</Muted>
                <Text style={styles.balanceValue}>
                  {(wallet?.balance ?? 0).toLocaleString()}{" "}
                  <Text style={styles.balanceCurrency}>{wallet?.currency ?? ""}</Text>
                </Text>
                <View style={styles.actionRow}>
                  {ACTIONS.map((a) => (
                    <Pressable key={a.key} style={styles.action} onPress={() => router.push(a.href)}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={a.icon} size={20} color={colors.accent} />
                      </View>
                      <Text style={styles.actionLabel}>{a.label}</Text>
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
            <Text style={styles.sectionTitle}>TRAINING</Text>
            <Pressable onPress={() => router.push("/(tabs)/training")}>
              <Card style={styles.trainingCard}>
                <CoinIcon emoji="🎬" from={palettes.violet.from} to={palettes.violet.to} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.trainingTitle}>Your progress</Text>
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
                    {completed} of {videos.length} videos completed
                  </Muted>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Card>
            </Pressable>
          </View>
        )}

        {/* My Account */}
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>MY ACCOUNT</Text>
          <Card style={{ padding: 0 }}>
            {EXAMPLE_ACCOUNTS.map((a, i) => (
              <View
                key={a.id}
                style={[styles.accountRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={styles.accountIcon}>
                  <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.accountName}>{a.name}</Text>
                  <Muted style={{ fontSize: 12 }}>{a.platform}</Muted>
                </View>
                <Tag label={a.status} color={a.color} />
              </View>
            ))}
          </Card>
          <Pressable
            onPress={() =>
              Alert.alert("Coming soon", "Account submission will be available in an upcoming update.")
            }
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="add-circle-outline" size={19} color={colors.background} />
            <Text style={styles.submitText}>Submit New Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBorder: { borderRadius: 20, padding: 1.5 },
  hero: { borderRadius: 18.5, backgroundColor: colors.surface, padding: 18 },
  heroTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  hello: { color: colors.foreground, fontSize: 20, fontWeight: "700" },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  balanceLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  balanceValue: {
    color: colors.accent,
    fontSize: 40,
    fontWeight: "800",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  balanceCurrency: { color: colors.muted, fontSize: 16, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  action: { flex: 1, alignItems: "center", gap: 6 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.foreground, fontSize: 10.5, fontWeight: "600" },
  sectionTitle: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  trainingCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  trainingTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  trainingPct: { color: colors.accent, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  accountRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
  },
  submitText: { color: colors.background, fontSize: 15, fontWeight: "700" },
});
