import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type WalletInfo, type WithdrawalItem } from "../../lib/api";
import { Muted, Screen, Tag } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, fonts } from "../../lib/theme";

// Withdrawal requests + their review status.

const STATUS: Record<WithdrawalItem["status"], { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { color: colors.warning, icon: "time-outline" },
  paid: { color: colors.success, icon: "checkmark-circle-outline" },
  rejected: { color: colors.danger, icon: "close-circle-outline" },
};

export default function RequestsScreen() {
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

  return (
    <Screen>
      <FlatList
        data={wallet?.withdrawals ?? []}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          wallet ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 44 }}>🧾</Text>
              <Muted>{t("no_requests")}</Muted>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const s = STATUS[item.status];
          return (
            <View style={styles.row}>
              <View style={[styles.statusIcon, { borderColor: s.color }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>
                  {item.amount.toLocaleString()} {item.currency}
                </Text>
                <Muted style={{ fontSize: 12 }}>
                  {new Date(item.requested_at).toLocaleString()}
                </Muted>
                {item.status === "rejected" && item.reject_reason ? (
                  <Muted style={{ fontSize: 12, color: colors.danger }}>{item.reject_reason}</Muted>
                ) : null}
              </View>
              <Tag label={item.status.toUpperCase()} color={s.color} />
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
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.foreground, fontSize: 15, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
});
