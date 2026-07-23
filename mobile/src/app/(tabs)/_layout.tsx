import { Redirect, Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, StyleSheet } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { useI18n } from "../../lib/i18n";
import { colors } from "../../lib/theme";

function BackButton() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ paddingHorizontal: 14 }}>
      <Ionicons name="arrow-back" size={22} color={colors.foreground} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { me } = useAuth();
  const { t } = useI18n();
  if (!me) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t("training"),
          href: me.modules.training ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="book-outline" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="myaccount"
        options={{
          title: t("my_account"),
          href: me.modules.bank_accounts ? undefined : null,
          tabBarIcon: () => (
            <View style={styles.fab}>
              <Ionicons name="briefcase-outline" color={colors.background} size={24} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: t("exams"),
          href: me.modules.exams ? undefined : null,
          tabBarIcon: ({ color }) => <Ionicons name="trophy-outline" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={color} size={24} />,
        }}
      />
      {/* Notifications lives behind the Home bell button — hidden from the tab bar */}
      <Tabs.Screen
        name="notifications"
        options={{ title: t("notification"), href: null, headerLeft: () => <BackButton /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    borderWidth: 3,
    borderColor: colors.background,
  },
});
