import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type BankAccountItem } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { Card, Muted, Screen, Tag } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, fonts } from "../../lib/theme";

const STATUS_COLORS: Record<BankAccountItem["status"], string> = {
  pending: colors.warning,
  active: colors.success,
  suspended: colors.warning,
  closed: colors.muted,
  rejected: colors.danger,
};

export default function MyAccountScreen() {
  const { me } = useAuth();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<BankAccountItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const enabled = me?.modules.bank_accounts ?? false;

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const { accounts } = await api.bankAccounts();
      setAccounts(accounts);
    } catch {
      // keep previous
    }
  }, [enabled]);

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
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {accounts !== null && accounts.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🏦</Text>
            <Text style={styles.emptyTitle}>{t("no_accounts")}</Text>
            <Muted style={{ textAlign: "center" }}>{t("no_accounts_body")}</Muted>
          </View>
        )}

        {(accounts ?? []).map((a) => (
          <Card key={a.id} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="business-outline" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{a.bank}</Text>
              <Muted style={{ fontSize: 12 }}>
                {a.company} · {a.account_no}
              </Muted>
              {a.status === "rejected" && a.reject_reason ? (
                <Muted style={{ fontSize: 12, color: colors.danger }}>{a.reject_reason}</Muted>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Tag label={a.status.toUpperCase()} color={STATUS_COLORS[a.status]} />
              {a.status === "active" && <Tag label={a.condition.toUpperCase()} color={colors.accentStrong} />}
            </View>
          </Card>
        ))}

        {enabled && (
          <Pressable
            onPress={() => router.push("/submit-account")}
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="add-circle-outline" size={19} color={colors.background} />
            <Text style={styles.submitText}>{t("submit_new_account")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.foreground, fontSize: 14, fontFamily: fonts.semibold },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  submitText: { color: colors.background, fontSize: 15, fontFamily: fonts.bold },
  empty: { alignItems: "center", gap: 10, paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontFamily: fonts.bold },
});
