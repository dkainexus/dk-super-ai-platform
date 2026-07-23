import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "../lib/theme";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Glowing coin-style icon chip, like the web dashboard StatCards. */
export function CoinIcon({ emoji, from, to }: { emoji: string; from: string; to: string }) {
  return (
    <LinearGradient colors={[from, to]} style={styles.coin} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.coinEmoji}>{emoji}</Text>
    </LinearGradient>
  );
}

export function Button({
  label,
  onPress,
  busy,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "outline" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "outline" && styles.btnOutline,
        variant === "danger" && styles.btnDanger,
        (pressed || busy) && { opacity: 0.7 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? colors.background : colors.foreground} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "primary" && { color: colors.background },
            variant === "danger" && { color: colors.danger },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Tag({ label, color = colors.muted }: { label: string; color?: string }) {
  return (
    <View style={[styles.tag, { borderColor: `${color}66` }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[{ color: colors.muted, fontSize: 13 }, style]}>{children}</Text>;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
  },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  coinEmoji: { fontSize: 20 },
  btn: {
    height: 48,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  btnDanger: { borderWidth: 1, borderColor: `${colors.danger}66`, backgroundColor: "transparent" },
  btnText: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  input: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.foreground,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  tag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  tagText: { fontSize: 10, fontWeight: "600" },
});
