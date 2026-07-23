import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenCapture from "expo-screen-capture";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { UpdateChecker } from "../components/update-checker";
import { colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync();

function Root() {
  const { ready } = useAuth();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // FLAG_SECURE for the whole app: blocks screenshots and makes screen
  // recordings render black (training-content protection).
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  if (!ready) return null;

  return (
    <>
    <UpdateChecker />
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="video/[id]" options={{ title: "Training" }} />
      <Stack.Screen name="exam/[id]" options={{ title: "Exam" }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}
