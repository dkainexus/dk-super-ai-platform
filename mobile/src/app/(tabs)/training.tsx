import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type VideoItem } from "../../lib/api";
import { Muted, Screen } from "../../components/ui";
import { colors, fonts } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

function fmtDuration(s: number | null): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function TrainingScreen() {
  const { t } = useI18n();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { videos } = await api.videos();
      setVideos(videos);
    } catch {
      // keep old list on network errors
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

  return (
    <Screen>
      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🎬</Text>
              <Muted>{t("no_videos")}</Muted>
            </View>
          ) : null
        }
        renderItem={({ item: v }) => {
          const pct =
            v.duration_seconds && v.duration_seconds > 0
              ? Math.min(100, Math.round((v.seconds_watched / v.duration_seconds) * 100))
              : 0;
          return (
            <Pressable
              onPress={() => router.push({ pathname: "/video/[id]", params: { id: v.id, title: v.title } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.thumbWrap}>
                {v.thumb_url ? (
                  <Image source={{ uri: v.thumb_url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <Text style={{ fontSize: 28 }}>🎬</Text>
                  </View>
                )}
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={14} color={colors.background} />
                </View>
                {v.duration_seconds ? (
                  <View style={styles.durBadge}>
                    <Text style={styles.durText}>{fmtDuration(v.duration_seconds)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ padding: 10, gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.title} numberOfLines={2}>
                    {v.title}
                  </Text>
                  {v.completed && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  )}
                </View>
                {pct > 0 && !v.completed && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceRaised },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  playBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  durBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  durText: { color: "#fff", fontSize: 11, fontVariant: ["tabular-nums"] },
  title: { color: colors.foreground, fontSize: 13, fontFamily: fonts.semibold, flexShrink: 1 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.background,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 2 },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
});
