import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { LanguageProvider, useI18n } from "../lib/i18n";
import { UpdateChecker } from "../components/update-checker";
import { initNotifications } from "../lib/notification-poller";
import { colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

function Root({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, me } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  // FLAG_SECURE for the whole app: blocks screenshots and makes screen
  // recordings render black (training-content protection).
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  // Once logged in, set up system notifications (channel + permission +
  // background poll) so alerts land in the phone's notification tray.
  useEffect(() => {
    if (me?.modules.notifications) initNotifications();
  }, [me?.modules.notifications]);

  if (!ready || !fontsLoaded) return null;

  return (
    <>
      <UpdateChecker />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="video/[id]" options={{ title: t("training") }} />
        <Stack.Screen name="exam/[id]" options={{ title: t("exam") }} />
        <Stack.Screen name="wallet/index" options={{ title: t("withdraw") }} />
        <Stack.Screen name="wallet/rewards" options={{ title: t("my_rewards") }} />
        <Stack.Screen name="wallet/transactions" options={{ title: t("transactions") }} />
        <Stack.Screen name="wallet/requests" options={{ title: t("requests") }} />
        <Stack.Screen name="submit-account" options={{ title: t("submit_new_account") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <LanguageProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root fontsLoaded={fontsLoaded} />
      </AuthProvider>
    </LanguageProvider>
  );
}
