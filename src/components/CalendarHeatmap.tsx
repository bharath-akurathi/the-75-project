import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import type { HeatmapDay } from '@/lib/database/calculations';

interface CalendarHeatmapProps {
  data: HeatmapDay[];
}

export function CalendarHeatmap({ data }: CalendarHeatmapProps) {
  // Split data into weeks (chunks of 7 days)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 4: return Colors.success;
      case 3: return 'rgba(34, 197, 94, 0.6)'; // Lighter success
      case 2: return Colors.amber;
      case 1: return Colors.danger;
      default: return Colors.dark.bgElevated; // No classes
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance Heatmap (Last 5 Weeks)</Text>
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekCol}>
            {week.map((day, dayIndex) => (
              <View
                key={`${weekIndex}-${dayIndex}`}
                style={[
                  styles.cell,
                  { backgroundColor: getIntensityColor(day.intensity) }
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Low</Text>
        <View style={[styles.legendCell, { backgroundColor: Colors.danger }]} />
        <View style={[styles.legendCell, { backgroundColor: Colors.amber }]} />
        <View style={[styles.legendCell, { backgroundColor: 'rgba(34, 197, 94, 0.6)' }]} />
        <View style={[styles.legendCell, { backgroundColor: Colors.success }]} />
        <Text style={styles.legendText}>High</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  title: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.base,
  },
  grid: {
    flexDirection: 'row',
    gap: 4,
  },
  weekCol: {
    gap: 4,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.base,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    color: Colors.dark.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
