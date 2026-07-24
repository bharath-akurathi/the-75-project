import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius, Shadow } from '@/lib/theme/tokens';

/**
 * Evidence Log Screen (FR-8)
 * Shows absences with evidence tags (medical/official) and photos.
 * Provides the ability to generate a condonation request letter.
 */
export default function EvidenceLogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Placeholder data
  const taggedAbsences = [
    {
      id: '1',
      date: 'Jul 10, 2026',
      subject: 'Data Structures',
      tag: 'medical',
      hasAttachment: true,
    },
    {
      id: '2',
      date: 'Jul 12, 2026',
      subject: 'Operating Systems',
      tag: 'official',
      hasAttachment: false,
    }
  ];

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      // In reality, this would save the URI locally and trigger the binary outbox sync
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Evidence Log</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Tags here are purely informational for your own tracking. They do not alter your computed attendance percentage (FR-8.2).
        </Text>

        {/* Generate Condonation Button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>
            Generate Condonation Request
          </Text>
        </TouchableOpacity>
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>
          Automatically drafts a letter if you are in the 65–74% band (FR-8.3).
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          TAGGED ABSENCES
        </Text>

        {taggedAbsences.map((record) => (
          <View
            key={record.id}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, Shadow.sm]}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.dateText, { color: colors.text }]}>{record.date}</Text>
                <Text style={[styles.subjectText, { color: colors.textSecondary }]}>{record.subject}</Text>
              </View>
              <View
                style={[
                  styles.tagBadge,
                  { backgroundColor: record.tag === 'medical' ? colors.dangerLight : colors.primaryLight }
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: record.tag === 'medical' ? colors.danger : colors.primary }
                  ]}
                >
                  {record.tag.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.border }]}
                onPress={handlePickImage}
              >
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {record.hasAttachment ? 'View Attachment' : '+ Add Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
  },
  backButton: { marginBottom: Spacing.md },
  backText: { ...Typography.body },
  title: { ...Typography.h1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },
  description: {
    ...Typography.bodySmall,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  primaryButton: {
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  primaryButtonText: { ...Typography.button },
  helperText: { ...Typography.caption, textAlign: 'center', marginBottom: Spacing.xl },
  sectionTitle: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: Radius.md,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  dateText: { ...Typography.label, marginBottom: 2 },
  subjectText: { ...Typography.caption },
  tagBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  tagText: { ...Typography.caption, fontWeight: '700', fontSize: 10 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionButtonText: { ...Typography.caption },
});
