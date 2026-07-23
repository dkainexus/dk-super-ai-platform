import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { Button, Card, Muted, Screen, Tag } from "../../components/ui";
import { colors } from "../../lib/theme";

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
          <Text style={styles.sectionTitle}>Account</Text>
          <Row label="Username" value={me.owner.username} />
          <Row label="Phone" value={me.owner.phone} />
          <Row label="Email" value={me.owner.email} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Payout Bank</Text>
          <Row label="Bank" value={me.owner.bank_name} />
          <Row label="Account No." value={me.owner.bank_account_no} />
          <Muted style={{ marginTop: 8, fontSize: 12 }}>
            Rewards are paid to this account. Contact your manager to change it.
          </Muted>
        </Card>

        <Button label="Sign Out" variant="danger" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceRaised },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
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
  value: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
});
