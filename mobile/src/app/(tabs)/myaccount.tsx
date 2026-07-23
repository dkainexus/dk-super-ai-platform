import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Muted, Screen, Tag } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { colors, fonts } from "../../lib/theme";

// Placeholder list until account submission is wired to the CMS.
const EXAMPLE_ACCOUNTS = [
  { id: "1", name: "@sunny_bkk", platform: "TikTok", emoji: "🎵", status: "ACTIVE", color: colors.success },
  { id: "2", name: "@mike.trader", platform: "Facebook", emoji: "📘", status: "PENDING", color: colors.warning },
  { id: "3", name: "@nan_2024", platform: "Instagram", emoji: "📸", status: "REVIEW", color: colors.accentStrong },
];

export default function MyAccountScreen() {
  const { t } = useI18n();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card style={{ padding: 0 }}>
          {EXAMPLE_ACCOUNTS.map((a, i) => (
            <View
              key={a.id}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <View style={styles.icon}>
                <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{a.name}</Text>
                <Muted style={{ fontSize: 12 }}>{a.platform}</Muted>
              </View>
              <Tag label={a.status} color={a.color} />
            </View>
          ))}
        </Card>
        <Pressable
          onPress={() => Alert.alert(t("coming_soon"), t("coming_soon_body"))}
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add-circle-outline" size={19} color={colors.background} />
          <Text style={styles.submitText}>{t("submit_new_account")}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
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
  },
  submitText: { color: colors.background, fontSize: 15, fontFamily: fonts.bold },
});
