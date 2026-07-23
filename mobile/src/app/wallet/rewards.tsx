import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, type WalletInfo } from "../../lib/api";
import { CoinIcon, Muted, Screen, Tag } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, palettes, fonts } from "../../lib/theme";

// My Rewards: pending offers (with progress) + received reward history.

export default function RewardsScreen() {
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWallet(await api.wallet());
    } catch {
      // keep previous
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

  const pending = wallet?.rewards?.pending ?? [];
  const received = wallet?.rewards?.received ?? [];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {wallet && pending.length === 0 && received.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🎁</Text>
            <Text style={styles.emptyTitle}>{t("no_rewards")}</Text>
            <Muted style={{ textAlign: "center" }}>
              {t("no_rewards_body")}
            </Muted>
          </View>
        )}

        {pending.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>{t("to_unlock")}</Text>
            {pending.map((r) => {
              const pct = r.progress && r.progress.total > 0
                ? Math.round((r.progress.completed / r.progress.total) * 100)
                : 0;
              return (
                <LinearGradient
                  key={r.id}
                  colors={[palettes.amber.from, palettes.pink.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pendingBorder}
                >
                  <View style={styles.pendingCard}>
                    <View style={styles.pendingTop}>
                      <CoinIcon emoji="🎁" from={palettes.amber.from} to={palettes.amber.to} />
                      <Tag label="PENDING" color={colors.warning} />
                    </View>
                    <Text style={styles.pendingAmount}>
                      +{r.amount.toLocaleString()}{" "}
                      <Text style={styles.pendingCurrency}>{wallet?.currency ?? ""}</Text>
                    </Text>
                    <Text style={styles.pendingTitle}>{r.id === "training" ? t("reward_training_title") : r.title}</Text>
                    {r.progress && (
                      <>
                        <View style={styles.progressTrack}>
                          <LinearGradient
                            colors={[palettes.mint.from, palettes.mint.to]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.progressFill, { width: `${Math.max(pct, 2)}%` }]}
                          />
                        </View>
                        <Muted style={{ fontSize: 12 }}>
                          {t("progress_of", { done: r.progress.completed, total: r.progress.total, pct })}
                        </Muted>
                      </>
                    )}
                  </View>
                </LinearGradient>
              );
            })}
          </View>
        )}

        {received.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>{t("received")}</Text>
            {received.map((r) => (
              <View key={r.id} style={styles.row}>
                <CoinIcon emoji="🏆" from={palettes.mint.from} to={palettes.mint.to} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Muted style={{ fontSize: 12 }}>{new Date(r.date).toLocaleDateString()}</Muted>
                </View>
                <Text style={styles.rowAmount}>
                  +{r.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.muted, fontSize: 11, fontFamily: fonts.bold, letterSpacing: 1.2 },
  pendingBorder: { borderRadius: 18, padding: 1.5 },
  pendingCard: { borderRadius: 16.5, backgroundColor: colors.surface, padding: 18, gap: 8 },
  pendingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pendingAmount: {
    color: colors.warning,
    fontSize: 32,
    fontFamily: fonts.extrabold,
    fontVariant: ["tabular-nums"],
  },
  pendingCurrency: { color: colors.muted, fontSize: 15, fontFamily: fonts.semibold },
  pendingTitle: { color: colors.foreground, fontSize: 14, fontFamily: fonts.semibold },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: { height: "100%", borderRadius: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  rowTitle: { color: colors.foreground, fontSize: 14, fontFamily: fonts.semibold },
  rowAmount: { color: colors.success, fontSize: 16, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 10, paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontFamily: fonts.bold },
});
