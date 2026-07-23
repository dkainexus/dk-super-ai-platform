import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { Button, Card, Muted, Screen, Tag } from "../../components/ui";
import { LANGS, useI18n } from "../../lib/i18n";
import { colors, fonts } from "../../lib/theme";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Muted>{label}</Muted>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { me, signOut } = useAuth();
  const { lang, setLang, t } = useI18n();
  if (!me) return null;

  const statusColor =
    me.owner.status === "approved" ? colors.success : me.owner.status === "banned" ? colors.danger : colors.warning;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card style={styles.headerCard}>
          {me.merchant.logo_url ? (
            <Image source={{ uri: me.merchant.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={{ fontSize: 24 }}>👤</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{me.owner.name ?? me.owner.username}</Text>
            <Muted>
              {me.merchant.name}
              {me.country.name ? ` · ${me.country.flag ?? ""} ${me.country.name}` : ""}
            </Muted>
            <Tag label={me.owner.status.toUpperCase()} color={statusColor} />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t("account")}</Text>
          <Row label={t("username")} value={me.owner.username} />
          <Row label={t("phone")} value={me.owner.phone} />
          <Row label={t("email")} value={me.owner.email} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t("payout_bank")}</Text>
          <Row label={t("bank")} value={me.owner.bank_name} />
          <Row label={t("account_no")} value={me.owner.bank_account_no} />
          <Muted style={{ marginTop: 8, fontSize: 12 }}>{t("bank_note")}</Muted>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t("language")}</Text>
          {LANGS.map((l, i) => (
            <Pressable
              key={l.code}
              onPress={() => setLang(l.code)}
              style={[styles.langRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <Text style={{ fontSize: 18 }}>{l.flag}</Text>
              <Text style={[styles.langLabel, lang === l.code && { color: colors.accent }]}>
                {l.label}
              </Text>
              {lang === l.code && <Ionicons name="checkmark-circle" size={19} color={colors.accent} />}
            </Pressable>
          ))}
        </Card>

        <Button label={t("sign_out")} variant="danger" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.foreground, fontSize: 18, fontFamily: fonts.bold },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  value: { color: colors.foreground, fontSize: 14, fontFamily: fonts.medium },
  langRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  langLabel: { flex: 1, color: colors.foreground, fontSize: 14, fontFamily: fonts.medium },
});
