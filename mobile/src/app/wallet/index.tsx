import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, ApiError, type WalletInfo } from "../../lib/api";
import { Button, Muted, Screen } from "../../components/ui";
import { colors, palettes } from "../../lib/theme";

// Withdraw screen: balance hero + amount entry with quick-pick chips.

const CHIPS = [0.25, 0.5, 0.75, 1] as const;

export default function WithdrawScreen() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
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

  const balance = wallet?.balance ?? 0;
  const pending = wallet?.withdrawals.find((w) => w.status === "pending");
  const value = parseFloat(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= balance;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await api.withdraw(value);
      setAmount("");
      Alert.alert(
        "Request sent 🎉",
        "Your withdrawal request has been received. Track it under Requests.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert("Withdrawal failed", e instanceof ApiError ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {/* Balance hero */}
        <LinearGradient
          colors={[palettes.mint.from, palettes.blue.to, palettes.violet.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBorder}
        >
          <View style={styles.hero}>
            <Muted style={styles.heroLabel}>AVAILABLE BALANCE</Muted>
            <Text style={styles.heroValue}>
              {balance.toLocaleString()} <Text style={styles.heroCurrency}>{wallet?.currency ?? ""}</Text>
            </Text>
            {wallet?.bank && (
              <View style={styles.bankRow}>
                <Ionicons name="business-outline" size={14} color={colors.muted} />
                <Muted style={{ fontSize: 12 }}>
                  {wallet.bank} · {wallet.bank_account_no ?? ""}
                </Muted>
              </View>
            )}
          </View>
        </LinearGradient>

        {pending ? (
          <View style={styles.pendingCard}>
            <Text style={{ fontSize: 30 }}>⏳</Text>
            <Text style={styles.pendingTitle}>Withdrawal pending</Text>
            <Muted style={{ textAlign: "center" }}>
              {pending.amount.toLocaleString()} {pending.currency} is being processed. You can request
              again once it completes.
            </Muted>
            <Button label="View Requests" variant="outline" onPress={() => router.push("/wallet/requests")} />
          </View>
        ) : (
          <>
            {/* Amount entry */}
            <View style={styles.amountCard}>
              <Muted style={styles.amountLabel}>ENTER AMOUNT</Muted>
              <View style={styles.amountRow}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  style={styles.amountInput}
                />
                <Text style={styles.amountCurrency}>{wallet?.currency ?? ""}</Text>
              </View>
              <View style={styles.chipRow}>
                {CHIPS.map((c) => {
                  const chipValue = Math.floor(balance * c);
                  const active = Number.isFinite(value) && value === chipValue && chipValue > 0;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setAmount(chipValue > 0 ? String(chipValue) : "")}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && { color: colors.background }]}>
                        {c === 1 ? "MAX" : `${c * 100}%`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {Number.isFinite(value) && value > balance && (
                <Muted style={{ color: colors.danger, fontSize: 12 }}>
                  Amount exceeds your balance.
                </Muted>
              )}
            </View>

            <Button
              label={valid ? `Withdraw ${value.toLocaleString()} ${wallet?.currency ?? ""}` : "Withdraw"}
              busy={submitting}
              variant={valid ? "primary" : "outline"}
              onPress={submit}
            />
            <Muted style={{ textAlign: "center", fontSize: 12 }}>
              Funds are transferred to your registered bank account after review.
            </Muted>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBorder: { borderRadius: 18, padding: 1.5 },
  hero: { borderRadius: 16.5, backgroundColor: colors.surface, padding: 20 },
  heroLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  heroValue: {
    color: colors.accent,
    fontSize: 38,
    fontWeight: "800",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  heroCurrency: { color: colors.muted, fontSize: 16, fontWeight: "600" },
  bankRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  pendingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  pendingTitle: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  amountCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  amountLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  amountInput: {
    color: colors.foreground,
    fontSize: 44,
    fontWeight: "800",
    minWidth: 90,
    textAlign: "center",
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  amountCurrency: { color: colors.muted, fontSize: 18, fontWeight: "600" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
});
