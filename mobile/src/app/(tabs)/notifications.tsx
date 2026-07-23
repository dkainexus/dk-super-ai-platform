import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, type NotificationItem } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Button, Muted, Screen, Tag } from "../../components/ui";
import { colors, fonts } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

const TYPE_COLORS: Record<NotificationItem["type"], string> = {
  general: colors.muted,
  company: colors.accentStrong,
  reward: colors.warning,
  training: colors.success,
  exam: colors.danger,
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.notifications);
      setUnread(res.unread);
    } catch {
      // keep old list
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function markOne(n: NotificationItem) {
    if (n.read_at) return;
    setItems((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.markRead(n.id);
      await refresh(); // update tab badge
    } catch {}
  }

  async function markAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnread(0);
    try {
      await api.markRead();
      await refresh();
    } catch {}
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          unread > 0 ? (
            <Button label={`Mark all ${unread} as read`} variant="outline" onPress={markAll} />
          ) : null
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🔔</Text>
              <Muted>{t("no_notifications")}</Muted>
            </View>
          ) : null
        }
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => markOne(n)}
            style={({ pressed }) => [
              styles.row,
              !n.read_at && styles.rowUnread,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Tag label={n.type.toUpperCase()} color={TYPE_COLORS[n.type]} />
                <Muted style={{ fontSize: 11 }}>{timeAgo(n.created_at)}</Muted>
                {!n.read_at && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.title}>{n.title}</Text>
              {n.body ? <Muted style={{ fontSize: 13 }}>{n.body}</Muted> : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  rowUnread: { borderColor: `${colors.accent}55`, backgroundColor: colors.surfaceRaised },
  title: { color: colors.foreground, fontSize: 15, fontFamily: fonts.semibold },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginLeft: "auto" },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
});
