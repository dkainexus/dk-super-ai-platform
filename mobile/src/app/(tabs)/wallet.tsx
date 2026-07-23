import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api, ApiError, type WalletInfo, type WalletTx, type WithdrawalItem } from "../../lib/api";
import { Button, Muted, Screen, Tag } from "../../components/ui";
import { colors } from "../../lib/theme";

const TX_LABEL: Record<WalletTx["type"], string> = {
  reward: "Reward",
  rent: "Rent",
  withdrawal: "Withdrawal",
  refund: "Refund",
  adjustment: "Adjustment",
};

const WD_COLORS: Record<WithdrawalItem["status"], string> = {
  pending: colors.warning,
  paid: colors.success,
  rejected: colors.danger,
};

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const pendingWithdrawal = wallet?.withdrawals.find((w) => w.status === "pending");

  async function submitWithdraw() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      await api.withdraw(value);
      setWithdrawOpen(false);
      setAmount("");
      Alert.alert("Request sent", "Your withdrawal request has been received. We will transfer it to your bank account.");
      await load();
    } catch (e) {
      Alert.alert("Withdrawal failed", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <FlatList
        data={wallet?.transactions ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View>
            {/* Balance card */}
            <View style={styles.balanceCard}>
              <Muted style={styles.balanceLabel}>WALLET BALANCE</Muted>
              <Text style={styles.balanceValue}>
                {(wallet?.balance ?? 0).toLocaleString()}{" "}
                <Text style={styles.balanceCurrency}>{wallet?.currency ?? ""}</Text>
              </Text>
              {wallet?.bank && (
                <Muted style={styles.bankLine}>
                  {wallet.bank} · {wallet.bank_account_no ?? ""}
                </Muted>
              )}
              <View style={{ marginTop: 14 }}>
                <Button
                  label={pendingWithdrawal ? "Withdrawal pending…" : "Withdraw"}
                  busy={false}
                  variant={pendingWithdrawal || (wallet?.balance ?? 0) <= 0 ? "outline" : "primary"}
                  onPress={() => {
                    if (pendingWithdrawal || (wallet?.balance ?? 0) <= 0) return;
                    setWithdrawOpen(true);
                  }}
                />
              </View>
            </View>

            {/* Withdrawal history */}
            {(wallet?.withdrawals.length ?? 0) > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Muted style={styles.sectionTitle}>WITHDRAWALS</Muted>
                {wallet!.withdrawals.map((w) => (
                  <View key={w.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {w.amount.toLocaleString()} {w.currency}
                      </Text>
                      <Muted style={styles.rowSub}>
                        {new Date(w.requested_at).toLocaleDateString()}
                        {w.status === "rejected" && w.reject_reason ? ` · ${w.reject_reason}` : ""}
                      </Muted>
                    </View>
                    <Tag color={WD_COLORS[w.status]} label={w.status.toUpperCase()} />
                  </View>
                ))}
              </View>
            )}

            <Muted style={styles.sectionTitle}>TRANSACTIONS</Muted>
            {wallet && wallet.transactions.length === 0 && (
              <Muted style={{ paddingVertical: 16 }}>No transactions yet.</Muted>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{TX_LABEL[item.type]}</Text>
              <Muted style={styles.rowSub}>
                {new Date(item.created_at).toLocaleDateString()}
                {item.note ? ` · ${item.note}` : ""}
              </Muted>
            </View>
            <Text style={[styles.amount, { color: item.amount >= 0 ? colors.success : colors.danger }]}>
              {item.amount >= 0 ? "+" : ""}
              {item.amount.toLocaleString()}
            </Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      />

      {/* Withdraw modal */}
      <Modal visible={withdrawOpen} transparent animationType="fade" onRequestClose={() => setWithdrawOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setWithdrawOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Withdraw</Text>
            <Muted style={{ marginBottom: 10 }}>
              Available: {(wallet?.balance ?? 0).toLocaleString()} {wallet?.currency ?? ""}
              {wallet?.bank ? `\nTo: ${wallet.bank} · ${wallet.bank_account_no ?? ""}` : ""}
            </Muted>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Button label="Request Withdrawal" busy={submitting} onPress={submitWithdraw} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { fontSize: 11, letterSpacing: 1 },
  balanceValue: { color: colors.accent, fontSize: 36, fontWeight: "700", marginTop: 6 },
  balanceCurrency: { color: colors.muted, fontSize: 16, fontWeight: "500" },
  bankLine: { marginTop: 6, fontSize: 12 },
  sectionTitle: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  rowTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
});
