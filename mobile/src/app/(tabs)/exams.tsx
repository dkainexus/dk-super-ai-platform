import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type ExamListItem } from "../../lib/api";
import { Muted, Screen, Tag } from "../../components/ui";
import { colors, fonts } from "../../lib/theme";
import { useI18n } from "../../lib/i18n";

export default function ExamsScreen() {
  const { t } = useI18n();
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { exams } = await api.exams();
      setExams(exams);
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

  return (
    <Screen>
      <FlatList
        data={exams}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>📝</Text>
              <Muted>{t("no_exams")}</Muted>
            </View>
          ) : null
        }
        renderItem={({ item: e }) => {
          const locked = !e.unlocked;
          const waiting = Boolean(e.wait_until);
          const missing = e.required_videos.filter((v) => !v.completed);
          return (
            <Pressable
              disabled={!e.can_take}
              onPress={() =>
                router.push({ pathname: "/exam/[id]", params: { id: e.id, title: e.title } })
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }, !e.can_take && { opacity: 0.75 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.iconWrap, e.passed && { backgroundColor: `${colors.success}22` }]}>
                  {e.passed ? (
                    <Ionicons name="trophy" size={20} color={colors.success} />
                  ) : locked ? (
                    <Ionicons name="lock-closed" size={20} color={colors.muted} />
                  ) : (
                    <Ionicons name="document-text" size={20} color={colors.accent} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title}>{e.title}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {e.question_count} questions · pass {e.pass_score}%
                    {e.attempts > 0 ? ` · best ${e.best_score ?? 0}%` : ""}
                  </Muted>
                </View>
                {e.passed ? (
                  <Tag label="PASSED" color={colors.success} />
                ) : e.attempts > 0 ? (
                  <Tag label={`${e.attempts}× TRIED`} color={colors.warning} />
                ) : null}
              </View>

              {e.description ? (
                <Muted style={{ fontSize: 12, marginTop: 8 }}>{e.description}</Muted>
              ) : null}

              {locked && missing.length > 0 && (
                <View style={styles.lockBox}>
                  <Muted style={{ fontSize: 12, color: colors.warning }}>
                    🔒 Finish these videos to unlock:
                  </Muted>
                  {missing.map((v) => (
                    <Muted key={v.id} style={{ fontSize: 12 }}>
                      • {v.title}
                    </Muted>
                  ))}
                </View>
              )}
              {waiting && (
                <Muted style={{ fontSize: 12, marginTop: 8, color: colors.warning }}>
                  ⏳ Retake available {new Date(e.wait_until!).toLocaleString()}
                </Muted>
              )}
              {e.can_take && (
                <View style={styles.takeRow}>
                  <Text style={styles.takeText}>{e.attempts > 0 ? "Retake exam" : "Start exam"}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.background} />
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.foreground, fontSize: 15, fontFamily: fonts.semibold },
  lockBox: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    padding: 10,
    gap: 3,
  },
  takeRow: {
    marginTop: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  takeText: { color: colors.background, fontSize: 14, fontFamily: fonts.bold },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
});
