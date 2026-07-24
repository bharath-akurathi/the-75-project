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
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getSlotsForDay, getExceptionsForDate, setException, removeException, getPreferences, getExamPeriods } from '@/database/queries';
import type { TimetableSlotWithSubject, DailyException, UserPreferences, ExamPeriod } from '@/database/queries';
import { PeriodCard, PeriodStatus } from '@/components/PeriodCard';
import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { getDayOfWeek, formatDate, formatDateDisplay, getDatesFromStart, isToday, parseDate } from '@/utils/dateHelpers';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<TimetableSlotWithSubject[]>([]);
  const [exceptions, setExceptions] = useState<DailyException[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [examPeriods, setExamPeriods] = useState<ExamPeriod[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const dayOfWeek = getDayOfWeek(selectedDate);
  const dateStr = formatDate(selectedDate);
  const isSunday = dayOfWeek === 'Sunday';

  const isExamMode = examPeriods.some(ep => dateStr >= ep.start_date && dateStr <= ep.end_date);

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
  }, [db, dayOfWeek, dateStr, isSunday]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
    return 'present';
  };

  const handleStatusChange = async (slot: TimetableSlotWithSubject, newStatus: PeriodStatus) => {
    if (newStatus === 'present') {
      // Remove exception (default is present)
      await removeException(db, dateStr, slot.period_num, slot.subject_id);
    } else {
      await setException(db, dateStr, slot.period_num, slot.subject_id, newStatus);
    }
    await loadData();
  };

  const handleDelete = async (slot: TimetableSlotWithSubject) => {
    // Mark as cancelled
    await setException(db, dateStr, slot.period_num, slot.subject_id, 'cancelled');
    await loadData();
  };

  // Stats
  const totalClasses = slots.length;
  const absentCount = exceptions.filter(e => e.status === 'absent').length;
  const cancelledCount = exceptions.filter(e => e.status === 'cancelled').length;
  const presentCount = totalClasses - absentCount - cancelledCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
      </View>

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
          slots.map((slot) => (
            <PeriodCard
              key={`${slot.id}-${slot.period_num}`}
              periodNum={slot.period_num}
              subjectName={slot.subject_name}
              subjectType={slot.subject_type}
              startTime={slot.start_time}
              endTime={slot.end_time}
              status={getStatus(slot)}
              onStatusChange={(status) => handleStatusChange(slot, status)}
              onDelete={() => handleDelete(slot)}
            />
          ))
        )}
      </ScrollView>
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
});
