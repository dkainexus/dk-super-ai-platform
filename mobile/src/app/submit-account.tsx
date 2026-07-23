import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { api, ApiError, type BankOption } from "../lib/api";
import { Button, Input, Muted, Screen } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { colors, fonts } from "../lib/theme";

// Submit New Account: company → bank → standard fields + the bank's own
// extra fields + its payment channels. Lands in the CMS as "pending".

export default function SubmitAccountScreen() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [bankId, setBankId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, { enabled: boolean; value?: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .bankAccountOptions()
      .then((o) => {
        setCompanies(o.companies);
        setBanks(o.banks);
        if (o.companies.length === 1) setCompanyId(o.companies[0].id);
      })
      .catch(() => {});
  }, []);

  const bank = useMemo(() => banks.find((b) => b.id === bankId) ?? null, [banks, bankId]);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!companyId || !bankId || !(form.account_no ?? "").trim()) {
      Alert.alert(t("submit_failed"), t("required_fields"));
      return;
    }
    setBusy(true);
    try {
      await api.submitBankAccount({
        company_id: companyId,
        bank_id: bankId,
        branch_address: form.branch_address,
        account_no: form.account_no.trim(),
        account_limit: form.account_limit ? parseFloat(form.account_limit) || undefined : undefined,
        email: form.email,
        sim_number: form.sim_number,
        login_id: form.login_id,
        password: form.password,
        extra,
        channels,
      });
      Alert.alert(t("submitted"), t("submitted_body"), [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert(t("submit_failed"), e instanceof ApiError ? e.message : t("try_again"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          {/* Company */}
          <View>
            <Muted style={styles.label}>{t("select_company").toUpperCase()}</Muted>
            <View style={styles.chipWrap}>
              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCompanyId(c.id)}
                  style={[styles.chip, companyId === c.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, companyId === c.id && { color: colors.background }]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Bank */}
          {companyId !== "" && (
            <View>
              <Muted style={styles.label}>{t("select_bank").toUpperCase()}</Muted>
              <View style={styles.chipWrap}>
                {banks.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => setBankId(b.id)}
                    style={[styles.chip, bankId === b.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, bankId === b.id && { color: colors.background }]}>
                      {b.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {bank && (
            <>
              <Field label={t("branch_address")} value={form.branch_address ?? ""} onChange={set("branch_address")} />
              <Field label={t("account_number")} value={form.account_no ?? ""} onChange={set("account_no")} keyboard="number-pad" />
              <Field label={t("account_limit")} value={form.account_limit ?? ""} onChange={set("account_limit")} keyboard="decimal-pad" />
              <Field label={t("email")} value={form.email ?? ""} onChange={set("email")} keyboard="email-address" />
              <Field label={t("sim_number")} value={form.sim_number ?? ""} onChange={set("sim_number")} keyboard="phone-pad" />
              <Field label={t("login_id")} value={form.login_id ?? ""} onChange={set("login_id")} />
              <Field label={t("password")} value={form.password ?? ""} onChange={set("password")} />
              {bank.account_fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={extra[f.key] ?? ""}
                  onChange={(v) => setExtra((e) => ({ ...e, [f.key]: v }))}
                />
              ))}

              {bank.channels.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Muted style={styles.label}>{t("payment_channels")}</Muted>
                  {bank.channels.map((c) => {
                    const state = channels[c] ?? { enabled: false };
                    return (
                      <View key={c} style={styles.channelRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Switch
                            value={state.enabled}
                            onValueChange={(v) =>
                              setChannels((ch) => ({ ...ch, [c]: { ...state, enabled: v } }))
                            }
                            trackColor={{ true: colors.accentStrong, false: colors.border }}
                            thumbColor="#fff"
                          />
                          <Text style={styles.channelName}>{c}</Text>
                        </View>
                        {state.enabled && (
                          <Input
                            value={state.value ?? ""}
                            onChangeText={(v: string) =>
                              setChannels((ch) => ({ ...ch, [c]: { ...state, value: v } }))
                            }
                            placeholder={t("linked_value")}
                            style={{ marginTop: 8 }}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <Button label={t("submit_review")} busy={busy} onPress={submit} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: "number-pad" | "decimal-pad" | "email-address" | "phone-pad";
}) {
  return (
    <View>
      <Muted style={styles.label}>{label.toUpperCase()}</Muted>
      <Input value={value} onChangeText={onChange} keyboardType={keyboard} autoCapitalize="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 1, fontFamily: fonts.bold, marginBottom: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.foreground, fontSize: 13, fontFamily: fonts.semibold },
  channelRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  channelName: { color: colors.foreground, fontSize: 14, fontFamily: fonts.semibold },
});
