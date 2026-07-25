/**
 * The 75 Project — Today Dashboard
 * Daily attendance marking with date selector for past dates
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSlotsForDay, getExceptionsForDate, setException, removeException, getPreferences, getExamPeriods, getUnmarkedDays, getAllSubjects, getActiveStudentId, getActiveSemesterId } from '@/lib/database/queries';
import { addExtraClass } from '@/lib/database/mutations';
import type { TimetableSlotWithSubject, DailyException, UserPreferences, ExamPeriod, Subject } from '@/lib/database/queries';
import { PeriodCard, PeriodStatus } from '@/components/PeriodCard';
import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { getDayOfWeek, formatDate, formatDateDisplay, getDatesFromStart, isToday, parseDate } from '@/utils/dateHelpers';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { Modal, TextInput } from 'react-native';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<TimetableSlotWithSubject[]>([]);
  const [exceptions, setExceptions] = useState<DailyException[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unmarkedDays, setUnmarkedDays] = useState<string[]>([]);
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);
  const [hasCheckedRetroactive, setHasCheckedRetroactive] = useState(false);

  // Extra Class Modal State
  const [showExtraClassModal, setShowExtraClassModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [extraPeriod, setExtraPeriod] = useState<string>('1');
  const [extraSpan, setExtraSpan] = useState<string>('1');

  const [undoState, setUndoState] = useState<{
    slot: TimetableSlotWithSubject;
    oldStatus: PeriodStatus;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const dayOfWeek = getDayOfWeek(selectedDate);
  const dateStr = formatDate(selectedDate);
  const isSunday = dayOfWeek === 'Sunday';

  const isExamMode = examPeriods.some(ep => dateStr >= ep.start_date && dateStr <= ep.end_date);

  // Load subjects for Extra Class modal
  const loadSubjects = useCallback(async () => {
    const s = await getAllSubjects(db);
    setSubjects(s);
    if (s.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(s[0].id);
    }
  }, [db]);

  const loadData = useCallback(async () => {
    const p = await getPreferences(db);
    setPrefs(p);
    
    const eps = await getExamPeriods(db);
    setExamPeriods(eps);

    const isCurrentExamMode = eps.some(ep => dateStr >= ep.start_date && dateStr <= ep.end_date);

    if (isSunday || isCurrentExamMode) {
      setSlots([]);
      setExceptions([]);
      return;
    }
    const s = await getSlotsForDay(db, dayOfWeek);
    const e = await getExceptionsForDate(db, dateStr);
    setSlots(s);
    setExceptions(e);
    if (!hasCheckedRetroactive) {
      const unmarked = await getUnmarkedDays(db);
      if (unmarked.length > 0) {
        setUnmarkedDays(unmarked);
        setShowRetroactiveModal(true);
      }
      setHasCheckedRetroactive(true);
    }
  }, [db, dayOfWeek, dateStr, isSunday, hasCheckedRetroactive]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadSubjects();
    }, [loadData, loadSubjects])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatus = (slot: TimetableSlotWithSubject): PeriodStatus => {
    const exception = exceptions.find(
      e => e.period_num === slot.period_num && e.subject_id === slot.subject_id
    );
    if (exception) return exception.status as PeriodStatus;
    // Default visually to present if completely unmarked
    return 'present';
  };

  const handleStatusChange = async (slot: TimetableSlotWithSubject, newStatus: PeriodStatus) => {
    const oldStatus = getStatus(slot);
    
    await setException(db, dateStr, slot.period_num, slot.subject_id, newStatus as any);
    await loadData();
    
    // Setup undo toast
    if (undoState?.timer) clearTimeout(undoState.timer);
    const timer = setTimeout(() => {
      setUndoState(null);
    }, 3000);
    setUndoState({ slot, oldStatus, timer });
  };

  const handleUndo = async () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    
    await setException(db, dateStr, undoState.slot.period_num, undoState.slot.subject_id, undoState.oldStatus as any);
    setUndoState(null);
    await loadData();
  };

  const handleDelete = async (slot: TimetableSlotWithSubject) => {
    // Mark as cancelled
    await setException(db, dateStr, slot.period_num, slot.subject_id, 'cancelled');
    await loadData();
  };

  const handleAddExtraClass = async () => {
    if (!selectedSubjectId || !extraPeriod) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const studentId = await getActiveStudentId(db);
      const semesterId = await getActiveSemesterId(db, studentId!);
      if (!studentId || !semesterId) return;
      
      const period = parseInt(extraPeriod, 10);
      const span = parseInt(extraSpan, 10) || 1;
      
      if (isNaN(period) || period < 1 || period > 10) {
        Alert.alert('Invalid Period', 'Please enter a valid period number (1-10).');
        return;
      }
      
      if (isNaN(span) || span < 1 || span > 4) {
        Alert.alert('Invalid Span', 'Please enter a valid span (1-4 periods).');
        return;
      }
      
      // Check for existing class at this slot
      const existingSlots = slots.filter(s => s.period_num === period);
      const performInsert = async () => {
        await addExtraClass(studentId, semesterId, dateStr, selectedSubjectId, period, span);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowExtraClassModal(false);
        await loadData();
        setExtraPeriod('1');
        setExtraSpan('1');
      };

      if (existingSlots.length > 0) {
        const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name || 'Unknown';
        Alert.alert(
          'Slot Conflict',
          `Period ${period} already has ${existingSlots[0].subject_name}. Add extra class for ${subjectName} anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Anyway',
              style: 'destructive',
              onPress: performInsert
            }
          ]
        );
        return;
      }

      await performInsert();
    } catch (error) {
      console.error('Failed to add extra class:', error);
      Alert.alert('Error', 'Failed to add extra class. Please try again.');
    }
  };

  // Stats
  const totalClasses = slots.length;
  const absentCount = exceptions.filter(e => e.status === 'absent').length;
  const cancelledCount = exceptions.filter(e => e.status === 'cancelled').length;
  const presentCount = totalClasses - absentCount - cancelledCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.dark.bgElevated, 'transparent']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <Logo size={32} />
          <Text style={styles.headerTitle}>The 75 Project</Text>
        </View>

        {/* Date Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroller}
          contentContainerStyle={styles.dateScrollerContent}
        >
          {getDatesFromStart(prefs?.semester_start || formatDate(new Date())).map((date, index) => {
            const isSelected = formatDate(date) === formatDate(selectedDate);
            const isTodayDate = isToday(date);
            const dayStr = getDayOfWeek(date);
            const isSun = dayStr === 'Sunday';

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateChip,
                  isSelected && styles.dateChipSelected,
                  isSun && styles.dateChipSunday,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDate(date);
                }}
              >
                <Text style={[
                  styles.dateChipDay,
                  isSelected && styles.dateChipDaySelected,
                ]}>
                  {dayStr.slice(0, 3)}
                </Text>
                <Text style={[
                  styles.dateChipNum,
                  isSelected && styles.dateChipNumSelected,
                ]}>
                  {date.getDate()}
                </Text>
                {isTodayDate && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Day Header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {isToday(selectedDate) ? 'Today' : formatDateDisplay(selectedDate)}
          </Text>
          {!isSunday && totalClasses > 0 && (
            <View style={styles.statsChips}>
              <View style={[styles.statChip, { backgroundColor: Colors.successBg }]}>
                <Text style={[styles.statChipText, { color: Colors.success }]}>{presentCount} present</Text>
              </View>
              {absentCount > 0 && (
                <View style={[styles.statChip, { backgroundColor: Colors.dangerBg }]}>
                  <Text style={[styles.statChipText, { color: Colors.danger }]}>{absentCount} absent</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Period Cards */}
      <ScrollView
        style={styles.cardsList}
        contentContainerStyle={styles.cardsListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.rose} />
        }
      >
        {isExamMode ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="alert-circle-outline"
              title="Exam Mode Active"
              subtitle="No attendance tracked during this phase. Focus on your exams!"
            />
          </View>
        ) : isSunday ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="calendar-clear-outline"
              title="It's Sunday!"
              subtitle="No classes scheduled for today. Enjoy your weekend."
            />
          </View>
        ) : slots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="document-text-outline"
              title="No Classes"
              subtitle="You don't have any classes scheduled for this day."
            />
          </View>
        ) : (
          slots.map((slot, index) => (
            <Animated.View
              key={`${slot.id}-${slot.period_num}`}
              entering={FadeInUp.delay(index * 100).springify()}
              layout={Layout.springify()}
            >
              <PeriodCard
                periodNum={slot.period_num}
                subjectName={slot.subject_name}
                subjectType={slot.subject_type}
                startTime={slot.start_time}
                endTime={slot.end_time}
                status={getStatus(slot)}
                onStatusChange={(status) => handleStatusChange(slot, status)}
                onDelete={() => handleDelete(slot)}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Undo Toast */}
      {undoState && (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText}>
            Marked {undoState.slot.subject_name}
          </Text>
          <TouchableOpacity onPress={handleUndo} style={styles.undoToastBtn}>
            <Text style={styles.undoToastBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retroactive Modal (FR-3.7) */}
      <Modal
        visible={showRetroactiveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRetroactiveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="calendar-outline" size={32} color={Colors.rose} />
            </View>
            <Text style={styles.modalTitle}>Catch Up Needed!</Text>
            <Text style={styles.modalSubtitle}>
              You have {unmarkedDays.length} day(s) with unmarked attendance. 
              Review them now to keep your 75% prediction accurate!
            </Text>

            <View style={styles.unmarkedList}>
              {unmarkedDays.slice(0, 3).map(d => (
                <View key={d} style={styles.unmarkedItem}>
                  <Ionicons name="alert-circle" size={16} color={Colors.amber} />
                  <Text style={styles.unmarkedItemText}>{formatDateDisplay(parseDate(d))}</Text>
                </View>
              ))}
              {unmarkedDays.length > 3 && (
                <Text style={styles.unmarkedItemText}>+ {unmarkedDays.length - 3} more days...</Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setShowRetroactiveModal(false);
                setSelectedDate(parseDate(unmarkedDays[0]));
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Review Now</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalSecondaryBtn}
              onPress={() => setShowRetroactiveModal(false)}
            >
              <Text style={styles.modalSecondaryBtnText}>Remind Me Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Extra Class FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowExtraClassModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Extra Class Modal */}
      <Modal
        visible={showExtraClassModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExtraClassModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Ionicons name="add-circle-outline" size={32} color={Colors.amber} />
            </View>
            <Text style={styles.modalTitle}>Add Extra Class</Text>
            <Text style={styles.modalSubtitle}>
              Record an extra class for {formatDateDisplay(selectedDate)}
            </Text>

            {/* Subject Selection */}
            <View style={styles.extraClassField}>
              <Text style={styles.extraClassLabel}>Subject</Text>
              <ScrollView style={styles.subjectList} horizontal showsHorizontalScrollIndicator={false}>
                {subjects.map(subject => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.subjectChip,
                      selectedSubjectId === subject.id && styles.subjectChipSelected
                    ]}
                    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedSubjectId(subject.id);
    }}
                  >
                    <Text style={[
                      styles.subjectChipText,
                      selectedSubjectId === subject.id && styles.subjectChipTextSelected
                    ]}>
                      {subject.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Period Number */}
            <View style={styles.extraClassField}>
              <Text style={styles.extraClassLabel}>Period Number</Text>
              <TextInput
                style={styles.extraClassInput}
                value={extraPeriod}
                onChangeText={setExtraPeriod}
                keyboardType="numeric"
                maxLength={2}
                placeholder="1"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>

            {/* Period Span */}
            <View style={styles.extraClassField}>
              <Text style={styles.extraClassLabel}>Period Span (1-4)</Text>
              <TextInput
                style={styles.extraClassInput}
                value={extraSpan}
                onChangeText={setExtraSpan}
                keyboardType="numeric"
                maxLength={1}
                placeholder="1"
                placeholderTextColor={Colors.dark.textMuted}
              />
            </View>

            <TouchableOpacity 
              style={styles.modalPrimaryBtn}
              onPress={handleAddExtraClass}
              disabled={!selectedSubjectId}
            >
              <Text style={styles.modalPrimaryBtnText}>Add Class</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalSecondaryBtn}
              onPress={() => setShowExtraClassModal(false)}
            >
              <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing['4xl'],
  },
  header: {
    paddingTop: 60,
    paddingBottom: Spacing.base,
    backgroundColor: Colors.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.base,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  dateScroller: {
    marginBottom: Spacing.base,
  },
  dateScrollerContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dateChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.bgCard,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateChipSelected: {
    backgroundColor: Colors.rose,
    borderColor: Colors.rose,
  },
  dateChipSunday: {
    opacity: 0.4,
  },
  dateChipDay: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginBottom: 2,
  },
  dateChipDaySelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  dateChipNum: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  dateChipNumSelected: {
    color: '#fff',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.rose,
    marginTop: 3,
  },
  todayDotSelected: {
    backgroundColor: '#fff',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  dayTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
  },
  statsChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statChip: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  statChipText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  cardsList: {
    flex: 1,
  },
  cardsListContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  unmarkedList: {
    width: '100%',
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  unmarkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  unmarkedItemText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
  },
  modalPrimaryBtn: {
    backgroundColor: Colors.rose,
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalPrimaryBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  modalSecondaryBtn: {
    width: '100%',
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textMuted,
  },
  undoToast: {
    position: 'absolute',
    bottom: Spacing['4xl'] + Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.dark.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  undoToastText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
    flex: 1,
  },
  undoToastBtn: {
    paddingLeft: Spacing.md,
  },
  undoToastBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.rose,
  },
  extraClassField: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  extraClassLabel: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: Typography.weight.medium,
  },
  subjectList: {
    maxHeight: 80,
  },
  subjectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.bgElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: Spacing.sm,
  },
  subjectChipSelected: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  subjectChipText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.text,
  },
  subjectChipTextSelected: {
    color: '#000',
    fontWeight: Typography.weight.semibold,
  },
  extraClassInput: {
    backgroundColor: Colors.dark.bgElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    width: '100%',
  },
  fab: {
    position: 'absolute',
    bottom: Spacing['4xl'] + Spacing.lg,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
