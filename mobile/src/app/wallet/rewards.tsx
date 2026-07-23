import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api, type WalletInfo } from "../../lib/api";
import { CoinIcon, Muted, Screen, Tag } from "../../components/ui";
import { colors, palettes } from "../../lib/theme";

// My Rewards: pending offers (with progress) + received reward history.

export default function RewardsScreen() {
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
            <Text style={styles.emptyTitle}>No rewards yet</Text>
            <Muted style={{ textAlign: "center" }}>
              Complete your training and tasks to start earning rewards.
            </Muted>
          </View>
        )}

        {pending.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>TO UNLOCK</Text>
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
                    <Text style={styles.pendingTitle}>{r.title}</Text>
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
                          {r.progress.completed} of {r.progress.total} completed · {pct}%
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
            <Text style={styles.sectionTitle}>RECEIVED</Text>
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
  sectionTitle: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  pendingBorder: { borderRadius: 18, padding: 1.5 },
  pendingCard: { borderRadius: 16.5, backgroundColor: colors.surface, padding: 18, gap: 8 },
  pendingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pendingAmount: {
    color: colors.warning,
    fontSize: 32,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  pendingCurrency: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  pendingTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
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
  rowTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  rowAmount: { color: colors.success, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 10, paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
});
