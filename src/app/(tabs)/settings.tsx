/**
 * The 75 Project — Settings Screen
 * Timetable editing, mode toggle, semester start, data management
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getPreferences,
  setCalculationMode,
  setSemesterStart as setSemesterStartDB,
  getAllSubjects,
  getAllSlots,
  addSubject,
  renameSubject,
  deleteSubject,
  addSlot,
  deleteSlot,
  resetAllData,
  getAllPeriodTimings,
  setSemesterEnd as setSemesterEndDB,
  setExamDates as setExamDatesDB,
  updateSubjectOffsets,
} from '@/lib/database/queries';
import type { Subject, TimetableSlotWithSubject, UserPreferences, PeriodTiming } from '@/lib/database/queries';
import { JsonPasteModal } from '@/components/JsonPasteModal';
import { validateTimetableJson, extractUniqueSubjects } from '@/utils/jsonValidator';
import { formatDate, formatDateDisplay, parseDate } from '@/utils/dateHelpers';
import { Logo } from '@/components/Logo';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SettingsScreen() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlotWithSubject[]>([]);
  const [timings, setTimings] = useState<PeriodTiming[]>([]);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();

  // Date picker states
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Manual slot add state
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [addSlotDay, setAddSlotDay] = useState('Monday');
  const [addSlotPeriod, setAddSlotPeriod] = useState('');
  const [addSlotSubjectId, setAddSlotSubjectId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const p = await getPreferences(db);
    const s = await getAllSubjects(db);
    const sl = await getAllSlots(db);
    const t = await getAllPeriodTimings(db);
    setPrefs(p);
    setSubjects(s);
    setSlots(sl);
    setTimings(t);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ============================================================
  // Handlers
  // ============================================================

  const handleModeToggle = async () => {
    if (!prefs) return;
    const newMode = prefs.calculation_mode === 'aggregate' ? 'per_subject' : 'aggregate';
    await setCalculationMode(db, newMode as 'aggregate' | 'per_subject');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
  };

  const handleDateChange = async (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      if (prefs?.semester_end && formatDate(selectedDate) > prefs.semester_end) {
        Alert.alert('Invalid Date', 'Semester start date cannot be after end date.');
        return;
      }
      await setSemesterStartDB(db, formatDate(selectedDate));
      await loadData();
    }
  };

  const handleEndDateChange = async (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) {
      if (prefs?.semester_start && formatDate(selectedDate) < prefs.semester_start) {
        Alert.alert('Invalid Date', 'Semester end date cannot be before start date.');
        return;
      }
      await setSemesterEndDB(db, formatDate(selectedDate));
      await loadData();
    }
  };


  const handleDeleteSlot = async (slotId: string) => {
    await deleteSlot(db, slotId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
  };

  const handleAddSlot = async () => {
    if (!addSlotSubjectId || !addSlotPeriod.trim()) {
      Alert.alert('Incomplete', 'Select a subject and enter a period number.');
      return;
    }
    const periodNum = parseInt(addSlotPeriod, 10);
    if (isNaN(periodNum) || periodNum < 1) {
      Alert.alert('Invalid', 'Period must be a positive number.');
      return;
    }
    await addSlot(db, addSlotDay, periodNum, addSlotSubjectId);
    setAddSlotPeriod('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
  };

  const handleJsonImport = async (jsonString: string) => {
    const result = validateTimetableJson(jsonString);
    if (!result.valid || !result.data) {
      Alert.alert('Invalid JSON', result.error || 'Unknown error');
      return;
    }

    try {
      const uniqueSubjects = extractUniqueSubjects(result.data);
      const existingSubjects = await getAllSubjects(db);
      const subjectMap: Record<string, string> = {};

      // Map existing subjects
      for (const s of existingSubjects) {
        subjectMap[s.name.toLowerCase()] = s.id;
      }

      // Create new subjects
      for (const { name, isLab } of uniqueSubjects) {
        if (!subjectMap[name.toLowerCase()]) {
          const id = await addSubject(db, name, isLab ? 'lab' : 'theory');
          subjectMap[name.toLowerCase()] = id;
        }
      }

      // Create slots
      for (const slot of result.data.slots) {
        const subjectId = subjectMap[slot.subject_raw.toLowerCase()];
        if (subjectId) {
          await addSlot(db, slot.day, slot.period_number, subjectId);
        }
      }

      setShowJsonModal(false);
      await loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', `Imported ${result.data.slots.length} slots.`);
    } catch {
      Alert.alert('Error', 'Failed to import timetable.');
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      '⚠️ Reset All Data',
      'This will permanently delete ALL your data — timetable, subjects, and attendance records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Last chance. All data will be permanently lost.',
              [
                { text: 'Keep Data', style: 'cancel' },
                {
                  text: 'Yes, Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAllData(db);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    await loadData();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Group slots by day
  const slotsByDay: Record<string, TimetableSlotWithSubject[]> = {};
  for (const slot of slots) {
    if (!slotsByDay[slot.day_of_week]) slotsByDay[slot.day_of_week] = [];
    slotsByDay[slot.day_of_week].push(slot);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Logo size={28} />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Guest Mode Sign-In Upgrade */}
        {!user && (
          <View style={styles.authUpgradeCard}>
            <View style={styles.authUpgradeIcon}>
              <Ionicons name="cloud-offline" size={24} color={Colors.amber} />
            </View>
            <View style={styles.authUpgradeText}>
              <Text style={styles.authUpgradeTitle}>Guest Mode Active</Text>
              <Text style={styles.authUpgradeSubtitle}>Sign in to backup your data and join class groups.</Text>
            </View>
            <TouchableOpacity 
              style={styles.authUpgradeButton}
              onPress={() => router.push('/(auth)/welcome')}
            >
              <Text style={styles.authUpgradeButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calculation Mode */}
        <Text style={styles.sectionLabel}>CALCULATION MODE</Text>
        <TouchableOpacity style={styles.settingCard} onPress={handleModeToggle}>
          <View style={styles.settingInfo}>
            <Ionicons name="swap-horizontal-outline" size={20} color={Colors.amber} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>
                {prefs?.calculation_mode === 'aggregate' ? 'Aggregate' : 'Per Subject'}
              </Text>
              <Text style={styles.settingSubtitle}>Tap to switch mode</Text>
            </View>
          </View>
          <View style={[styles.modeBadge, {
            backgroundColor: prefs?.calculation_mode === 'aggregate'
              ? 'rgba(245, 158, 11, 0.15)' : 'rgba(225, 29, 72, 0.15)',
          }]}>
            <Text style={[styles.modeBadgeText, {
              color: prefs?.calculation_mode === 'aggregate' ? Colors.amber : Colors.rose,
            }]}>
              {prefs?.calculation_mode === 'aggregate' ? 'AGG' : 'SUB'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Semester Start */}
        <Text style={styles.sectionLabel}>SEMESTER START</Text>
        <TouchableOpacity
          style={styles.settingCard}
          onPress={() => setShowDatePicker(!showDatePicker)}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="calendar-outline" size={20} color={Colors.amber} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>
                {prefs?.semester_start
                  ? formatDateDisplay(parseDate(prefs.semester_start))
                  : 'Not set'}
              </Text>
              <Text style={styles.settingSubtitle}>Tap to change</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        {showDatePicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={prefs?.semester_start ? parseDate(prefs.semester_start) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleDateChange}
              maximumDate={new Date()}
              themeVariant="dark"
            />
          </View>
        )}

        {/* Semester End */}
        <Text style={styles.sectionLabel}>SEMESTER END</Text>
        <TouchableOpacity
          style={styles.settingCard}
          onPress={() => setShowEndPicker(!showEndPicker)}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="calendar-outline" size={20} color={Colors.rose} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>
                {prefs?.semester_end
                  ? formatDateDisplay(parseDate(prefs.semester_end))
                  : 'Not set'}
              </Text>
              <Text style={styles.settingSubtitle}>Tap to change</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        {showEndPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              value={prefs?.semester_end ? parseDate(prefs.semester_end) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={handleEndDateChange}
              minimumDate={prefs?.semester_start ? parseDate(prefs.semester_start) : undefined}
              themeVariant="dark"
            />
          </View>
        )}

        {/* Navigation Section */}
        <Text style={styles.sectionLabel}>CONFIGURATION</Text>
        
        <TouchableOpacity
          style={styles.settingCard}
          onPress={() => router.push('/manage-exams')}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.amber} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Exam Phases</Text>
              <Text style={styles.settingSubtitle}>Pause attendance during exams</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingCard, { marginTop: Spacing.sm }]}
          onPress={() => router.push('/manage-subjects')}
        >
          <View style={styles.settingInfo}>
            <Ionicons name="book-outline" size={20} color={Colors.rose} />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Manage Subjects</Text>
              <Text style={styles.settingSubtitle}>Edit subjects & tweak manual classes</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>

        {/* Timetable */}
        <Text style={styles.sectionLabel}>TIMETABLE ({slots.length} slots)</Text>

        <TouchableOpacity
          style={styles.importButton}
          onPress={() => setShowJsonModal(true)}
        >
          <Ionicons name="sparkles" size={18} color={Colors.amber} />
          <Text style={styles.importButtonText}>Import from AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.importButton, { borderColor: Colors.rose }]}
          onPress={() => setShowAddSlot(!showAddSlot)}
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.rose} />
          <Text style={[styles.importButtonText, { color: Colors.rose }]}>Add Slot Manually</Text>
        </TouchableOpacity>

        {showAddSlot && subjects.length > 0 && (
          <View style={styles.addSlotForm}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayChips}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, addSlotDay === day && styles.dayChipActive]}
                  onPress={() => setAddSlotDay(day)}
                >
                  <Text style={[styles.dayChipText, addSlotDay === day && styles.dayChipTextActive]}>
                    {day.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.slotInput}
              value={addSlotPeriod}
              onChangeText={setAddSlotPeriod}
              placeholder="Period #"
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="numeric"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectChips}>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.subjectChip, addSlotSubjectId === s.id && styles.subjectChipActive]}
                  onPress={() => setAddSlotSubjectId(s.id)}
                >
                  <Text style={[styles.subjectChipText, addSlotSubjectId === s.id && styles.subjectChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.addSlotButton} onPress={handleAddSlot}>
              <Text style={styles.addSlotButtonText}>Add Slot</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Timetable Grid */}
        {DAYS.filter(d => slotsByDay[d]).map((day) => (
          <View key={day} style={styles.timetableDay}>
            <Text style={styles.timetableDayLabel}>{day}</Text>
            {slotsByDay[day]
              .sort((a, b) => a.period_num - b.period_num)
              .map((slot) => (
                <View key={slot.id} style={styles.timetableSlot}>
                  <Text style={styles.timetableSlotPeriod}>P{slot.period_num}</Text>
                  <Text style={styles.timetableSlotName} numberOfLines={1}>{slot.subject_name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteSlot(slot.id)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={Colors.dark.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        ))}

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { color: Colors.danger, marginTop: Spacing['2xl'] }]}>
          DANGER ZONE
        </Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleResetAll}>
          <Ionicons name="nuclear-outline" size={20} color={Colors.danger} />
          <Text style={styles.dangerButtonText}>Reset All Data</Text>
        </TouchableOpacity>

        <View style={styles.versionInfo}>
          <Logo size={24} />
          <Text style={styles.versionText}>The 75 Project v1.0</Text>
          <Text style={styles.versionSubtext}>MIT License • Built for JNTUH students</Text>
        </View>
      </ScrollView>

      <JsonPasteModal
        visible={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        onImport={handleJsonImport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  authUpgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: Spacing.lg,
  },
  authUpgradeIcon: {
    marginRight: Spacing.md,
  },
  authUpgradeText: {
    flex: 1,
  },
  authUpgradeTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.amber,
  },
  authUpgradeSubtitle: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  authUpgradeButton: {
    backgroundColor: Colors.amber,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
  },
  authUpgradeButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.bg,
  },
  sectionLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.textMuted,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.dark.text,
  },
  settingSubtitle: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginTop: 1,
  },
  modeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
  },
  modeBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    letterSpacing: Typography.letterSpacing.wide,
  },
  pickerContainer: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  subjectCard: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectName: {
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    flex: 1,
  },
  subjectActions: {
    flexDirection: 'row',
    gap: Spacing.base,
    alignItems: 'center',
  },
  manualAdjustments: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  manualStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manualStatLabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
  },
  manualStatValue: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
    fontWeight: Typography.weight.semibold,
    minWidth: 20,
    textAlign: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  editInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  addSubjectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  addSubjectInput: {
    flex: 1,
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addSubjectButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.amber,
    marginBottom: Spacing.sm,
  },
  importButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.amber,
  },
  addSlotForm: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.md,
  },
  dayChips: {
    flexDirection: 'row',
  },
  dayChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgElevated,
    marginRight: Spacing.sm,
  },
  dayChipActive: {
    backgroundColor: Colors.rose,
  },
  dayChipText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textSecondary,
  },
  dayChipTextActive: {
    color: '#fff',
    fontWeight: Typography.weight.semibold,
  },
  slotInput: {
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  subjectChips: {
    flexDirection: 'row',
  },
  subjectChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgElevated,
    marginRight: Spacing.sm,
  },
  subjectChipActive: {
    backgroundColor: Colors.amber,
  },
  subjectChipText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textSecondary,
  },
  subjectChipTextActive: {
    color: '#fff',
    fontWeight: Typography.weight.semibold,
  },
  addSlotButton: {
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  addSlotButtonText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  timetableDay: {
    marginBottom: Spacing.base,
  },
  timetableDayLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.amber,
    letterSpacing: Typography.letterSpacing.wide,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  timetableSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dark.bgCard,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timetableSlotPeriod: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.rose,
    width: 28,
  },
  timetableSlotName: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
    flex: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  dangerButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.danger,
  },
  versionInfo: {
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing['3xl'],
    paddingTop: Spacing.xl,
  },
  versionText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.dark.textMuted,
  },
  versionSubtext: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
  },
});
