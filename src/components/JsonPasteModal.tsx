/**
 * The 75 Project — JSON Paste Modal
 * Modal for pasting LLM-generated timetable JSON
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

const LLM_PROMPT = `You are extracting a weekly class timetable from an image.
Return ONLY valid JSON, no markdown, no commentary, in this schema:

{
  "slots": [
    {
      "day": "Monday",
      "period_number": 1,
      "subject_raw": "exactly as written on the timetable",
      "is_lab": false
    }
  ]
}

Rules:
- If a cell is empty, contains "...", "---", or indicates no class, set subject_raw to "---" (it will be skipped automatically).
- Set "is_lab" to true if the subject is a lab/practical session.
- Labs that span multiple periods: create ONE slot and set is_lab to true (the app handles the 3-hour duration automatically).
- Never invent a subject or period that isn't visible in the source.`;

interface JsonPasteModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => void;
}

export function JsonPasteModal({ visible, onClose, onImport }: JsonPasteModalProps) {
  const [jsonText, setJsonText] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);

  const handleCopyPrompt = async () => {
    await Clipboard.setStringAsync(LLM_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleImport = () => {
    if (!jsonText.trim()) {
      Alert.alert('Empty Input', 'Please paste the JSON from your LLM first.');
      return;
    }
    onImport(jsonText);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Import Timetable</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Copy prompt */}
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Copy this prompt</Text>
            </View>
            <Text style={styles.stepDescription}>
              Send this to ChatGPT, Gemini, or Claude along with a photo of your timetable.
            </Text>

            <View style={styles.promptBox}>
              <ScrollView style={styles.promptScroll} nestedScrollEnabled>
                <Text style={styles.promptText}>{LLM_PROMPT}</Text>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.copyButton} onPress={handleCopyPrompt}>
              <Ionicons
                name={promptCopied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={promptCopied ? Colors.success : Colors.amber}
              />
              <Text style={[styles.copyButtonText, promptCopied && { color: Colors.success }]}>
                {promptCopied ? 'Copied!' : 'Copy Prompt'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Step 2: Paste JSON */}
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Paste the result</Text>
            </View>
            <Text style={styles.stepDescription}>
              Paste the JSON that the AI generated below.
            </Text>

            <TextInput
              style={styles.textInput}
              multiline
              value={jsonText}
              onChangeText={setJsonText}
              placeholder='{"slots": [...]}'
              placeholderTextColor={Colors.dark.textMuted}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </ScrollView>

        {/* Import Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.importButton, !jsonText.trim() && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={!jsonText.trim()}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.importButtonText}>Import Timetable</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepContainer: {
    marginBottom: Spacing['2xl'],
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepBadgeText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: '#fff',
  },
  stepTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
  },
  stepDescription: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.md,
    marginLeft: 40,
  },
  promptBox: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  promptScroll: {
    maxHeight: 180,
  },
  promptText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.fontFamily.mono,
    color: Colors.dark.textSecondary,
    lineHeight: Typography.size.xs * Typography.lineHeight.relaxed,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.amber,
  },
  copyButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.amber,
  },
  textInput: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    minHeight: 150,
    fontSize: Typography.size.sm,
    fontFamily: Typography.fontFamily.mono,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.base,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  importButtonDisabled: {
    opacity: 0.4,
  },
  importButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
});
