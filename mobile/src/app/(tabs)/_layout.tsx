import { Redirect, Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useAuth } from "../../lib/auth-context";
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
  if (!me) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: "Training",
          href: me.modules.training ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: "Exams",
          href: me.modules.exams ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" color={color} size={size} />
          ),
        }}
      />
      {/* Wallet lives on the Home card and Alerts behind the bell button — both hidden from the tab bar */}
      <Tabs.Screen
        name="wallet"
        options={{ title: "Wallet", href: null, headerLeft: () => <BackButton /> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Alerts", href: null, headerLeft: () => <BackButton /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
