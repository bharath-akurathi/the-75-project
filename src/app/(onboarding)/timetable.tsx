/**
 * The 75 Project — Timetable Setup Screen (Onboarding Step 4)
 * Two paths: Paste JSON or Manual Entry
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { addSubject, addSlot, getAllSubjects, getAllSlots } from '@/lib/database/queries';
import { validateTimetableJson, extractUniqueSubjects } from '@/utils/jsonValidator';
import { CloneModal } from '@/components/CloneModal';
import { ImageUploadModal } from '@/components/ImageUploadModal';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import type { Subject, TimetableSlotWithSubject } from '@/lib/database/queries';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlotWithSubject[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [newDay, setNewDay] = useState('Monday');
  const [newPeriod, setNewPeriod] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [showDayPicker, setShowDayPicker] = useState(false);

  const refreshData = useCallback(async () => {
    const s = await getAllSubjects(db);
    const sl = await getAllSlots(db);
    setSubjects(s);
    setSlots(sl);
  }, [db]);

  const handleJsonImport = async (jsonString: string) => {
    const result = validateTimetableJson(jsonString);
    if (!result.valid || !result.data) {
      Alert.alert('Invalid JSON', result.error || 'Unknown error');
      return;
    }

    try {
      // Extract unique subjects and create them
      const uniqueSubjects = extractUniqueSubjects(result.data);
      const subjectMap: Record<string, string> = {};

      for (const { name, isLab } of uniqueSubjects) {
        const id = await addSubject(db, name, isLab ? 'lab' : 'theory');
        subjectMap[name] = id;
      }

      // Create slots
      for (const slot of result.data.slots) {
        const subjectId = subjectMap[slot.subject_raw];
        if (subjectId) {
          await addSlot(db, slot.day, slot.period_number, subjectId);
        }
      }

      setShowJsonModal(false);
      setShowCloneModal(false);
      await refreshData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', `Imported ${uniqueSubjects.length} subjects and ${result.data.slots.length} slots.`);
    } catch (error: any) {
      console.error('Import error details:', error);
      Alert.alert('Import Error', `Failed to import: ${error.message || error}`);
    }
  };

  const handleManualAdd = async () => {
    if (!newSubject.trim() || !newPeriod.trim()) {
      Alert.alert('Incomplete', 'Please fill in subject name and period number.');
      return;
    }

    const periodNum = parseInt(newPeriod, 10);
    if (isNaN(periodNum) || periodNum < 1) {
      Alert.alert('Invalid Period', 'Period must be a positive number.');
      return;
    }

    try {
      // Find or create subject
      let subjectId: string;
      const existing = subjects.find(
        s => s.name.toLowerCase() === newSubject.trim().toLowerCase()
      );
      if (existing) {
        subjectId = existing.id;
      } else {
        subjectId = await addSubject(db, newSubject.trim());
      }

      await addSlot(db, newDay, periodNum, subjectId);
      await refreshData();
      setNewSubject('');
      setNewPeriod('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert('Error', 'Failed to add slot.');
    }
  };

  const handleContinue = () => {
    if (slots.length === 0) {
      Alert.alert(
        'No Timetable',
        'You haven\'t added any classes yet. Continue anyway?',
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Continue', onPress: () => router.push('/(onboarding)/done') },
        ]
      );
      return;
    }
    router.push('/(onboarding)/done');
  };

  // Group slots by day
  const slotsByDay: Record<string, TimetableSlotWithSubject[]> = {};
  for (const slot of slots) {
    if (!slotsByDay[slot.day_of_week]) slotsByDay[slot.day_of_week] = [];
    slotsByDay[slot.day_of_week].push(slot);
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepLabel}>STEP 4 OF 4</Text>
        <Text style={styles.title}>Your Timetable</Text>
        <Text style={styles.subtitle}>
          Import from an AI or add classes manually.
        </Text>

        {/* Import Options */}
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => setShowImageModal(true)}
          >
            <Ionicons name="camera" size={22} color={Colors.amber} />
            <Text style={styles.optionButtonTitle}>AI Import</Text>
            <Text style={styles.optionButtonSub}>Scan Image</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => setShowCloneModal(true)}
          >
            <Ionicons name="people-outline" size={22} color={Colors.success} />
            <Text style={styles.optionButtonTitle}>Clone</Text>
            <Text style={styles.optionButtonSub}>Share Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionButton, showManual && styles.optionButtonActive]}
            onPress={() => setShowManual(!showManual)}
          >
            <Ionicons name="create-outline" size={22} color={Colors.rose} />
            <Text style={styles.optionButtonTitle}>Manual</Text>
            <Text style={styles.optionButtonSub}>One-by-one</Text>
          </TouchableOpacity>
        </View>

        {/* Manual Entry Form */}
        {showManual && (
          <View style={styles.manualForm}>
            {/* Day Selector */}
            <TouchableOpacity
              style={styles.daySelector}
              onPress={() => setShowDayPicker(!showDayPicker)}
            >
              <Text style={styles.daySelectorLabel}>Day</Text>
              <View style={styles.daySelectorValue}>
                <Text style={styles.daySelectorText}>{newDay}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.dark.textMuted} />
              </View>
            </TouchableOpacity>

            {showDayPicker && (
              <View style={styles.dayPickerContainer}>
                {DAYS.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayOption, newDay === day && styles.dayOptionActive]}
                    onPress={() => { setNewDay(day); setShowDayPicker(false); }}
                  >
                    <Text style={[styles.dayOptionText, newDay === day && styles.dayOptionTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 0.3 }]}
                value={newPeriod}
                onChangeText={setNewPeriod}
                placeholder="Period #"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 0.7 }]}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="Subject Name"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleManualAdd}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Slot</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Timetable Preview */}
        {slots.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>
              {slots.length} class{slots.length !== 1 ? 'es' : ''} added
            </Text>

            {DAYS.filter(d => slotsByDay[d]).map((day) => (
              <View key={day} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>{day}</Text>
                <View style={styles.daySlots}>
                  {slotsByDay[day]
                    .sort((a, b) => a.period_num - b.period_num)
                    .map((slot) => (
                      <View key={slot.id} style={styles.slotChip}>
                        <Text style={styles.slotChipPeriod}>P{slot.period_num}</Text>
                        <Text style={styles.slotChipName} numberOfLines={1}>{slot.subject_name}</Text>
                      </View>
                    ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.dark.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctaButton} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.ctaText}>Finish Setup</Text>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <JsonPasteModal
        visible={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        onImport={handleJsonImport}
      />
      <CloneModal
        visible={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        onImport={handleJsonImport}
      />
      <ImageUploadModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
        onImport={handleJsonImport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
    paddingTop: 70,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  stepLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.rose,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  optionButton: {
    flex: 1,
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  optionButtonActive: {
    borderColor: Colors.rose,
    backgroundColor: 'rgba(225, 29, 72, 0.06)',
  },
  optionButtonTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
  },
  optionButtonSub: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
  },
  manualForm: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  daySelectorLabel: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textMuted,
  },
  daySelectorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daySelectorText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.dark.text,
  },
  dayPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dayOption: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgElevated,
  },
  dayOptionActive: {
    backgroundColor: Colors.rose,
  },
  dayOptionText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textSecondary,
  },
  dayOptionTextActive: {
    color: '#fff',
    fontWeight: Typography.weight.semibold,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.amber,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  addButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  previewSection: {
    marginTop: Spacing.sm,
  },
  previewTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.base,
  },
  dayGroup: {
    marginBottom: Spacing.base,
  },
  dayLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.amber,
    letterSpacing: Typography.letterSpacing.wide,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  daySlots: {
    gap: Spacing.xs,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dark.bgCard,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  slotChipPeriod: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.rose,
    width: 24,
  },
  slotChipName: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['4xl'],
    paddingTop: Spacing.base,
    gap: Spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  backText: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  ctaText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
});
