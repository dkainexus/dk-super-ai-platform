import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { api } from "../../lib/api";
import { Muted, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";

// Training player. The whole app runs under FLAG_SECURE (see _layout), so
// screenshots are blocked and screen recordings capture black frames.
export default function VideoScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const navigation = useNavigation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    let alive = true;
    api
      .videoUrl(String(id))
      .then(({ url }) => alive && setUrl(url))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load video"));
    return () => {
      alive = false;
    };
  }, [id]);

  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    if (!url) return;
    player
      .replaceAsync(url)
      .then(() => player.play())
      .catch(() => setError("Could not play this video"));
  }, [url, player]);

  // Report watch progress every 10s while playing, immediately when playback
  // reaches the end, and once more on exit (reading the live position — the
  // interval snapshot alone can miss the final stretch and never mark
  // completion on short videos).
  const last = useRef({ seconds: 0, duration: 0 });
  useEffect(() => {
    const report = () => {
      const seconds = Math.max(Math.floor(player.currentTime || 0), last.current.seconds);
      const duration = Math.floor(player.duration || 0) || last.current.duration;
      if (seconds > 0) {
        last.current = { seconds, duration };
        const completed = duration > 0 && seconds / duration >= 0.9;
        api.reportProgress(String(id), seconds, completed).catch(() => {});
      }
    };
    const timer = setInterval(report, 10000);
    const ended = player.addListener("playToEnd", () => {
      const duration = Math.floor(player.duration || 0) || last.current.duration;
      last.current = { seconds: duration, duration };
      api.reportProgress(String(id), duration, true).catch(() => {});
    });
    return () => {
      clearInterval(timer);
      ended.remove();
      report();
    };
  }, [id, player]);

  return (
    <Screen>
      {error ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 32 }}>⚠️</Text>
          <Muted>{error}</Muted>
        </View>
      ) : !url ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Muted>Loading video…</Muted>
        </View>
      ) : (
        <View style={styles.playerWrap}>
          <VideoView
            player={player}
            style={styles.player}
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture={false}
            nativeControls
            contentFit="contain"
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  playerWrap: { flex: 1, justifyContent: "center", backgroundColor: "#000" },
  player: { width: "100%", aspectRatio: 16 / 9 },
});
