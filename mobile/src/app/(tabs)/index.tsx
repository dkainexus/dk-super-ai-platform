import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type NotificationItem, type VideoItem } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Card, CoinIcon, Muted, Screen, Tag } from "../../components/ui";
import { colors, palettes } from "../../lib/theme";

const TYPE_COLORS: Record<NotificationItem["type"], string> = {
  general: colors.muted,
  company: colors.accentStrong,
  reward: colors.warning,
  training: colors.success,
  exam: colors.danger,
};

export default function HomeScreen() {
  const { me, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, n] = await Promise.all([
        me?.modules.training ? api.videos() : Promise.resolve({ videos: [] }),
        me?.modules.notifications
          ? api.notifications()
          : Promise.resolve({ notifications: [], unread: 0 }),
      ]);
      setVideos(v.videos);
      setNotifs(n.notifications.slice(0, 5));
    } catch {
      // keep whatever we had
    }
  }, [me?.modules.training, me?.modules.notifications]);

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
        contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi {me?.owner.name ?? me?.owner.username ?? ""} 👋</Text>
            <Muted>
              {me?.merchant.name}
              {me?.country.name ? ` · ${me.country.flag ?? ""} ${me.country.name}` : ""}
            </Muted>
          </View>
        </View>

        {/* Hero: training progress */}
        <LinearGradient
          colors={[colors.surfaceRaised, colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <Muted>Training progress</Muted>
          <Text style={styles.heroValue}>{progressPct}%</Text>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[palettes.mint.from, "#2563eb"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(progressPct, 2)}%` }]}
            />
          </View>
          <Muted style={{ marginTop: 8 }}>
            {completed} of {videos.length} videos completed
          </Muted>
        </LinearGradient>

        {/* Stat cards */}
        <View style={styles.statRow}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/training")}>
            <Card style={styles.statCard}>
              <CoinIcon emoji="🎬" from={palettes.violet.from} to={palettes.violet.to} />
              <Text style={styles.statValue}>{videos.length}</Text>
              <Muted>Training videos</Muted>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push("/(tabs)/notifications")}>
            <Card style={styles.statCard}>
              <CoinIcon emoji="🔔" from={palettes.pink.from} to={palettes.pink.to} />
              <Text style={styles.statValue}>{me?.unread_notifications ?? 0}</Text>
              <Muted>Unread alerts</Muted>
            </Card>
          </Pressable>
        </View>

        {/* Latest notifications */}
        {notifs.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionTitle}>LATEST NEWS</Text>
            <Card style={{ padding: 0 }}>
              {notifs.map((n, i) => (
                <View
                  key={n.id}
                  style={[styles.notifRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Tag label={n.type.toUpperCase()} color={TYPE_COLORS[n.type]} />
                      {!n.read_at && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    {n.body ? (
                      <Muted style={{ fontSize: 12 }} >
                        {n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body}
                      </Muted>
                    ) : null}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center" },
  hello: { color: colors.foreground, fontSize: 22, fontWeight: "700" },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  heroValue: {
    color: colors.accent,
    fontSize: 44,
    fontWeight: "800",
    marginVertical: 4,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  statRow: { flexDirection: "row", gap: 14 },
  statCard: { flex: 1, gap: 8 },
  statValue: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  notifRow: { flexDirection: "row", padding: 14 },
  notifTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
