import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type ExamPaper, type ExamResult } from "../../lib/api";
import { Button, Card, Muted, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";

export default function ExamScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const navigation = useNavigation();
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    let alive = true;
    api
      .examPaper(String(id))
      .then((p) => alive && setPaper(p))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load the exam"));
    return () => {
      alive = false;
    };
  }, [id]);

  const answered =
    paper?.questions.filter((q) =>
      q.type === "choice" ? choices[q.id] != null : (texts[q.id] ?? "").trim().length > 0
    ).length ?? 0;

  function confirmSubmit() {
    const total = paper?.questions.length ?? 0;
    const message =
      answered < total
        ? `You answered ${answered} of ${total} questions. Unanswered questions score 0. Submit anyway?`
        : "Submit your answers to the AI examiner?";
    Alert.alert("Submit exam", message, [
      { text: "Keep working", style: "cancel" },
      { text: "Submit", style: "default", onPress: submit },
    ]);
  }

  async function submit() {
    if (!paper) return;
    setGrading(true);
    try {
      const answers = paper.questions.map((q) =>
        q.type === "choice"
          ? { question_id: q.id, answer_index: choices[q.id] }
          : { question_id: q.id, answer_text: texts[q.id] ?? "" }
      );
      setResult(await api.submitExam(String(id), answers));
    } catch (err) {
      Alert.alert("Submission failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setGrading(false);
    }
  }

  if (error) {
    return (
      <Screen style={styles.center}>
        <Text style={{ fontSize: 32 }}>⚠️</Text>
        <Muted>{error}</Muted>
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (grading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.gradingTitle}>AI examiner is grading…</Text>
        <Muted>This takes a few seconds. Don't close the app.</Muted>
      </Screen>
    );
  }

  if (result) {
    const commentFor = (qid: string) => result.feedback.per_question.find((p) => p.question_id === qid);
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Card style={[styles.resultHero, result.passed ? styles.passBorder : styles.failBorder]}>
            <Text style={{ fontSize: 44 }}>{result.passed ? "🎉" : "📚"}</Text>
            <Text style={[styles.scoreText, { color: result.passed ? colors.success : colors.danger }]}>
              {result.score}%
            </Text>
            <Text style={styles.resultTitle}>{result.passed ? "Passed!" : "Not passed yet"}</Text>
            <Muted style={{ textAlign: "center" }}>{result.feedback.overall}</Muted>
            <Muted style={{ fontSize: 12 }}>Pass mark: {result.pass_score}%</Muted>
          </Card>

          {result.questions.map((q, i) => {
            const fb = commentFor(q.id);
            if (!fb) return null;
            const good = fb.score >= 60;
            return (
              <Card key={q.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Ionicons
                    name={good ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={good ? colors.success : colors.danger}
                  />
                  <Text style={styles.qTitle}>
                    Q{i + 1}. {q.question}
                  </Text>
                </View>
                <Muted style={{ fontSize: 13 }}>
                  {q.type === "essay" ? `AI score ${fb.score}% — ` : ""}
                  {fb.comment}
                </Muted>
              </Card>
            );
          })}

          <Button label="Done" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  if (!paper) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Muted>Loading exam…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Muted>
            {paper.questions.length} questions · pass mark {paper.exam.pass_score}% · essays are graded by
            the AI examiner
          </Muted>

          {paper.questions.map((q, i) => (
            <Card key={q.id} style={{ gap: 10 }}>
              <Text style={styles.qTitle}>
                Q{i + 1}. {q.question}{" "}
                <Text style={{ color: colors.muted, fontSize: 12 }}>({q.points} pt)</Text>
              </Text>
              {q.type === "choice" ? (
                <View style={{ gap: 8 }}>
                  {q.options.map((opt, oi) => {
                    const selected = choices[q.id] === oi;
                    return (
                      <Pressable
                        key={oi}
                        onPress={() => setChoices({ ...choices, [q.id]: oi })}
                        style={[styles.option, selected && styles.optionSelected]}
                      >
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <Text style={[styles.optionText, selected && { color: colors.foreground }]}>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="Type your answer…"
                  placeholderTextColor={colors.muted}
                  value={texts[q.id] ?? ""}
                  onChangeText={(t) => setTexts({ ...texts, [q.id]: t })}
                  style={styles.essayInput}
                />
              )}
            </Card>
          ))}

          <Button
            label={`Submit (${answered}/${paper.questions.length} answered)`}
            onPress={confirmSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  gradingTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
  qTitle: { color: colors.foreground, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.surfaceRaised,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: "rgba(55,240,194,0.08)" },
  optionText: { color: colors.muted, fontSize: 14, flexShrink: 1 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  essayInput: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.foreground,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  resultHero: { alignItems: "center", gap: 6, paddingVertical: 24 },
  passBorder: { borderColor: `${colors.success}66` },
  failBorder: { borderColor: `${colors.danger}66` },
  scoreText: { fontSize: 42, fontWeight: "800", fontVariant: ["tabular-nums"] },
  resultTitle: { color: colors.foreground, fontSize: 18, fontWeight: "700" },
});
