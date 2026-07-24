/**
 * The 75 Project — Insights Screen (The Bunk Meter)
 * Shows aggregate or per-subject attendance stats
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPreferences } from '@/database/queries';
import {
  calculateAggregate,
  calculatePerSubject,
  type AggregateResult,
  type SubjectResult,
} from '@/database/calculations';
import { AttendanceRing } from '@/components/AttendanceRing';
import { SubjectRow } from '@/components/SubjectRow';
import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';

export default function InsightsScreen() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<'aggregate' | 'per_subject'>('aggregate');
  const [aggregateData, setAggregateData] = useState<AggregateResult | null>(null);
  const [subjectData, setSubjectData] = useState<SubjectResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasData, setHasData] = useState(false);

  const loadData = useCallback(async () => {
    const prefs = await getPreferences(db);
    setMode(prefs.calculation_mode);

    if (!prefs.semester_start) {
      setHasData(false);
      return;
    }

    // Always fetch per-subject data so we can show it in both modes
    const subjectResults = await calculatePerSubject(db, prefs.semester_start);
    setSubjectData(subjectResults);

    if (prefs.calculation_mode === 'aggregate') {
      const result = await calculateAggregate(db, prefs.semester_start);
      setAggregateData(result);
      setHasData(result.totalHeld > 0 || subjectResults.length > 0);
    } else {
      setHasData(subjectResults.length > 0);
    }
  }, [db]);

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

  const getBunkMeterColor = (safeBunks: number) => {
    if (safeBunks >= 5) return Colors.success;
    if (safeBunks >= 1) return Colors.amber;
    return Colors.danger;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Logo size={28} />
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <Text style={styles.modeLabel}>
          {mode === 'aggregate' ? 'Aggregate Mode' : 'Per-Subject Mode'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.rose} />
        }
      >
        {!hasData ? (
          <EmptyState
            icon="bar-chart-outline"
            title="No Data Yet"
            subtitle="Start marking attendance to see your insights here."
          />
        ) : mode === 'aggregate' && aggregateData ? (
          <>
            {/* Central Ring */}
            <View style={styles.ringSection}>
              <AttendanceRing
                percentage={aggregateData.percentage}
                size={200}
                label="Overall Attendance"
                sublabel={`${aggregateData.totalAttended} / ${aggregateData.totalHeld} classes`}
              />
            </View>

            {/* Bunk Meter */}
            <View style={styles.bunkMeterCard}>
              <Text style={styles.bunkMeterLabel}>THE BUNK METER</Text>
              <View style={styles.bunkMeterCenter}>
                {aggregateData.safeBunks >= 0 ? (
                  <>
                    <Text style={[styles.bunkMeterNumber, { color: getBunkMeterColor(aggregateData.safeBunks) }]}>
                      {aggregateData.safeBunks}
                    </Text>
                    <Text style={styles.bunkMeterUnit}>
                      class{aggregateData.safeBunks !== 1 ? 'es' : ''} you can safely skip
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.bunkMeterNumber, { color: Colors.danger }]}>
                      {aggregateData.classesNeeded}
                    </Text>
                    <Text style={[styles.bunkMeterUnit, { color: Colors.danger }]}>
                      more class{aggregateData.classesNeeded !== 1 ? 'es' : ''} needed to reach 75%
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="school-outline" size={20} color={Colors.amber} />
                <Text style={styles.statValue}>{aggregateData.totalHeld}</Text>
                <Text style={styles.statLabel}>Total Held</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                <Text style={styles.statValue}>{aggregateData.totalAttended}</Text>
                <Text style={styles.statLabel}>Attended</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.absent.text} />
                <Text style={styles.statValue}>{aggregateData.totalHeld - aggregateData.totalAttended}</Text>
                <Text style={styles.statLabel}>Missed</Text>
              </View>
            </View>

            {/* Per-Subject List in Aggregate Mode */}
            <View style={{ marginTop: Spacing.xl }}>
              <Text style={styles.sectionTitle}>Per-Subject Breakdown</Text>
              <Text style={styles.sectionSubtitle}>
                Sorted by attendance — lowest first
              </Text>
              
              {subjectData.map((subject) => (
                <SubjectRow
                  key={subject.subjectId}
                  subjectName={subject.subjectName}
                  percentage={subject.percentage}
                  safeBunks={subject.safeBunks}
                  classesNeeded={subject.classesNeeded}
                  held={subject.held}
                  attended={subject.attended}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Per-Subject List */}
            <Text style={styles.sectionTitle}>Subjects by Risk</Text>
            <Text style={styles.sectionSubtitle}>
              Sorted by attendance — lowest first
            </Text>

            {subjectData.map((subject) => (
              <SubjectRow
                key={subject.subjectId}
                subjectName={subject.subjectName}
                percentage={subject.percentage}
                safeBunks={subject.safeBunks}
                classesNeeded={subject.classesNeeded}
                held={subject.held}
                attended={subject.attended}
              />
            ))}
          </>
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
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  modeLabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    letterSpacing: Typography.letterSpacing.wide,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },
  ringSection: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  bunkMeterCard: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  bunkMeterLabel: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.textMuted,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing.base,
  },
  bunkMeterCenter: {
    alignItems: 'center',
  },
  bunkMeterNumber: {
    fontSize: Typography.size.hero,
    fontWeight: Typography.weight.heavy,
    letterSpacing: Typography.letterSpacing.tight,
  },
  bunkMeterUnit: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textMuted,
    marginBottom: Spacing.xl,
  },
});
