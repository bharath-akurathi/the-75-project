/**
 * The 75 Project — Period Card Component
 * Shows subject info with 3 status buttons + trash icon
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { formatTime } from '@/utils/dateHelpers';

export type PeriodStatus = 'present' | 'absent' | 'cancelled';

interface PeriodCardProps {
  periodNum: number;
  subjectName: string;
  subjectType: string;
  startTime?: string;
  endTime?: string;
  status: PeriodStatus;
  onStatusChange: (status: PeriodStatus) => void;
  onDelete: () => void;
}

export function PeriodCard({
  periodNum,
  subjectName,
  subjectType,
  startTime,
  endTime,
  status,
  onStatusChange,
  onDelete,
}: PeriodCardProps) {
  const statusColors = {
    present: Colors.present,
    absent: Colors.absent,
    cancelled: Colors.cancelled,
  };

  const currentColors = statusColors[status];

  const handleStatusPress = (newStatus: PeriodStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onStatusChange(newStatus);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Period',
      `Remove "${subjectName}" (Period ${periodNum}) from today?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This will mark this period as cancelled for today.',
              [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    onDelete();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const timeDisplay = startTime && endTime
    ? `${formatTime(startTime)} - ${formatTime(endTime)}`
    : `Period ${periodNum}`;

  return (
    <View style={[styles.card, { backgroundColor: currentColors.bg, borderColor: currentColors.border }]}>
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.periodBadge, { backgroundColor: currentColors.border }]}>
            <Text style={[styles.periodNum, { color: currentColors.text }]}>P{periodNum}</Text>
          </View>
          <View style={styles.subjectInfo}>
            <Text style={styles.subjectName} numberOfLines={1}>{subjectName}</Text>
            <Text style={styles.timeText}>{timeDisplay}</Text>
          </View>
        </View>

        {/* Trash Icon */}
        <TouchableOpacity onPress={handleDelete} style={styles.trashButton} hitSlop={8}>
          <Ionicons name="trash-outline" size={14} color={Colors.dark.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Status Buttons Row */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'present' && styles.activeButton,
            status === 'present' && { backgroundColor: Colors.success, borderColor: Colors.success },
          ]}
          onPress={() => handleStatusPress('present')}
        >
          <Ionicons
            name={status === 'present' ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={16}
            color={status === 'present' ? '#fff' : Colors.success}
          />
          <Text style={[
            styles.buttonText,
            status === 'present' && styles.activeButtonText,
            { color: status === 'present' ? '#fff' : Colors.success },
          ]}>Present</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'absent' && styles.activeButton,
            status === 'absent' && { backgroundColor: Colors.absent.text, borderColor: Colors.absent.text },
          ]}
          onPress={() => handleStatusPress('absent')}
        >
          <Ionicons
            name={status === 'absent' ? 'close-circle' : 'close-circle-outline'}
            size={16}
            color={status === 'absent' ? '#fff' : Colors.absent.text}
          />
          <Text style={[
            styles.buttonText,
            status === 'absent' && styles.activeButtonText,
            { color: status === 'absent' ? '#fff' : Colors.absent.text },
          ]}>Absent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'cancelled' && styles.activeButton,
            status === 'cancelled' && { backgroundColor: Colors.cancelled.text, borderColor: Colors.cancelled.text },
          ]}
          onPress={() => handleStatusPress('cancelled')}
        >
          <Ionicons
            name={status === 'cancelled' ? 'ban' : 'ban-outline'}
            size={16}
            color={status === 'cancelled' ? '#fff' : Colors.cancelled.text}
          />
          <Text style={[
            styles.buttonText,
            status === 'cancelled' && styles.activeButtonText,
            { color: status === 'cancelled' ? '#fff' : Colors.cancelled.text },
          ]}>Cancelled</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  periodBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  periodNum: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  timeText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    letterSpacing: Typography.letterSpacing.wide,
  },
  trashButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
  },
  activeButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  activeButtonText: {
    color: '#fff',
  },
});
