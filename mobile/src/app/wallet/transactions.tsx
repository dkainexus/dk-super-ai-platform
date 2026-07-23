import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api, type WalletInfo, type WalletTx } from "../../lib/api";
import { CoinIcon, Muted, Screen } from "../../components/ui";
import { colors, palettes } from "../../lib/theme";

const TX_META: Record<WalletTx["type"], { label: string; emoji: string; from: string; to: string }> = {
  reward: { label: "Reward", emoji: "🏆", from: palettes.amber.from, to: palettes.amber.to },
  rent: { label: "Rent", emoji: "🏠", from: palettes.blue.from, to: palettes.blue.to },
  withdrawal: { label: "Withdrawal", emoji: "💸", from: palettes.pink.from, to: palettes.pink.to },
  refund: { label: "Refund", emoji: "↩️", from: palettes.mint.from, to: palettes.mint.to },
  adjustment: { label: "Adjustment", emoji: "⚖️", from: palettes.violet.from, to: palettes.violet.to },
};

export default function TransactionsScreen() {
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

  return (
    <Screen>
      <FlatList
        data={wallet?.transactions ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          wallet ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 44 }}>📄</Text>
              <Muted>No transactions yet.</Muted>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const meta = TX_META[item.type];
          return (
            <View style={styles.row}>
              <CoinIcon emoji={meta.emoji} from={meta.from} to={meta.to} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>{meta.label}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleDateString()}
                  {item.note ? ` · ${item.note}` : ""}
                </Muted>
              </View>
              <Text
                style={[styles.amount, { color: item.amount >= 0 ? colors.success : colors.danger }]}
              >
                {item.amount >= 0 ? "+" : ""}
                {item.amount.toLocaleString()}
              </Text>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  amount: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
});
