import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Button, Input, Screen } from "../components/ui";
import { colors } from "../lib/theme";

export default function LoginScreen() {
  const { me, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me) return <Redirect href="/(tabs)" />;

  async function onLogin() {
    if (!username.trim() || !password) {
      setError("Enter your username and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrap}
      >
        <View style={styles.badgeWrap}>
          <LinearGradient
            colors={[colors.accent, "#2563eb"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>DK</Text>
          </LinearGradient>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in with the account your manager gave you</Text>

        <View style={{ gap: 12, marginTop: 28 }}>
          <Input
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <Input
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onLogin}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Sign In" onPress={onLogin} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  badgeWrap: { alignItems: "center", marginBottom: 24 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 26, fontWeight: "800", color: colors.background },
  title: {
    color: colors.foreground,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 6 },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
