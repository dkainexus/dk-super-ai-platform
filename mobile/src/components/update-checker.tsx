import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Application from "expo-application";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import Constants from "expo-constants";
import { Button, Muted } from "./ui";
import { colors, fonts } from "../lib/theme";
import { useI18n } from "../lib/i18n";

// In-app updater: checks /api/app/version on launch, and when a newer
// version is published shows a prompt — one tap downloads the APK with a
// progress bar and hands it to the Android installer.

const API_BASE: string =
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ?? "https://www.dkglobal.group";

type Release = { version_code: number; version_name: string; notes: string | null; url: string | null };

export function UpdateChecker() {
  const { t } = useI18n();
  const [release, setRelease] = useState<Release | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/app/version`);
        const json = (await res.json()) as { release: Release | null };
        const current = parseInt(Application.nativeBuildVersion ?? "0", 10) || 0;
        if (json.release && json.release.url && json.release.version_code > current) {
          setRelease(json.release);
        }
      } catch {
        // offline — try again next launch
      }
    })();
  }, []);

  const install = useCallback(async () => {
    if (!release?.url || downloading) return;
    setDownloading(true);
    setPct(0);
    try {
      const target = `${FileSystem.cacheDirectory}dk-app-${release.version_code}.apk`;
      const dl = FileSystem.createDownloadResumable(release.url, target, {}, (p) => {
        if (p.totalBytesExpectedToWrite > 0) {
          setPct(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
        }
      });
      const result = await dl.downloadAsync();
      if (!result?.uri) throw new Error("Download failed");
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: "application/vnd.android.package-archive",
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    } catch {
      Alert.alert(t("update_failed"), t("update_failed_body"));
    } finally {
      setDownloading(false);
    }
  }, [release, downloading]);

  if (!release || dismissed) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("update_available")}</Text>
          <Text style={styles.version}>v{release.version_name}</Text>
          {release.notes ? <Muted style={styles.notes}>{release.notes}</Muted> : null}

          {downloading ? (
            <View style={{ marginTop: 16 }}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <Muted style={{ marginTop: 8, textAlign: "center" }}>{t("downloading", { pct })}</Muted>
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Button label={t("update_now")} onPress={install} />
              <Pressable onPress={() => setDismissed(true)} style={styles.later}>
                <Muted style={{ textAlign: "center" }}>{t("later")}</Muted>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  title: { color: colors.foreground, fontSize: 18, fontFamily: fonts.bold },
  version: { color: colors.accent, fontSize: 26, fontFamily: fonts.bold, marginTop: 4 },
  notes: { marginTop: 8, lineHeight: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  later: { paddingVertical: 6 },
});
