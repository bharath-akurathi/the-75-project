import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { getAllSubjects, addSubject, renameSubject, deleteSubject, updateSubjectOffsets, getPreferences, type Subject } from '@/database/queries';
import { calculatePerSubject, type SubjectResult } from '@/database/calculations';

export default function ManageSubjectsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectResult[]>([]);
  
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  const loadSubjects = useCallback(async () => {
    const data = await getAllSubjects(db);
    setSubjects(data);

    const prefs = await getPreferences(db);
    if (prefs.semester_start) {
      const stats = await calculatePerSubject(db, prefs.semester_start);
      setSubjectStats(stats);
    } else {
      setSubjectStats([]);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
    }, [loadSubjects])
  );

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    await addSubject(db, newSubjectName.trim());
    setNewSubjectName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadSubjects();
  };

  const handleRenameSubject = async (id: number) => {
    if (!editingSubjectName.trim()) return;
    await renameSubject(db, id, editingSubjectName.trim());
    setEditingSubjectId(null);
    setEditingSubjectName('');
    await loadSubjects();
  };

  const handleDeleteSubject = async (id: number, name: string) => {
    // In a real app we might show an alert here.
    await deleteSubject(db, id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadSubjects();
  };

  const handleManualOffset = async (subjectId: number, heldChange: number, attendedChange: number) => {
    const subject = subjects.find(s => s.id === subjectId);
    const stat = subjectStats.find(s => s.subjectId === subjectId);
    if (!subject) return;

    const currentTotalHeld = stat ? stat.held : subject.manual_held_offset;
    const currentTotalAttended = stat ? stat.attended : subject.manual_attended_offset;

    let finalAttendedChange = attendedChange;

    // If decreasing held, automatically decrease attended as well (if > 0)
    if (heldChange < 0 && attendedChange === 0 && currentTotalAttended > 0) {
      finalAttendedChange = -1;
    }

    const proposedTotalHeld = currentTotalHeld + heldChange;
    const proposedTotalAttended = currentTotalAttended + finalAttendedChange;

    // Prevent negative totals
    if (proposedTotalHeld < 0 || proposedTotalAttended < 0) return;

    // Prevent attended > held
    if (proposedTotalAttended > proposedTotalHeld) return;

    const newHeld = subject.manual_held_offset + heldChange;
    const newAttended = subject.manual_attended_offset + finalAttendedChange;

    await updateSubjectOffsets(db, subjectId, newHeld, newAttended);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadSubjects();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Subjects</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.description}>
          Manually tweak classes held or attended if you missed logging them on a specific day.
        </Text>

        {/* Add Subject */}
        <View style={styles.addSubjectRow}>
          <TextInput
            style={styles.addSubjectInput}
            value={newSubjectName}
            onChangeText={setNewSubjectName}
            placeholder="New subject name"
            placeholderTextColor={Colors.dark.textMuted}
            onSubmitEditing={handleAddSubject}
          />
          <TouchableOpacity style={styles.addSubjectButton} onPress={handleAddSubject}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Subjects List */}
        <Text style={styles.sectionTitle}>Subjects ({subjects.length})</Text>
        {subjects.map((subject) => {
          const stat = subjectStats.find(s => s.subjectId === subject.id);
          const displayHeld = stat ? stat.held : subject.manual_held_offset;
          const displayAttended = stat ? stat.attended : subject.manual_attended_offset;

          return (
          <View key={subject.id} style={styles.subjectCard}>
            {editingSubjectId === subject.id ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={editingSubjectName}
                  onChangeText={setEditingSubjectName}
                  autoFocus
                  onSubmitEditing={() => handleRenameSubject(subject.id)}
                />
                <TouchableOpacity onPress={() => handleRenameSubject(subject.id)}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingSubjectId(null)}>
                  <Ionicons name="close-circle" size={24} color={Colors.dark.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.subjectRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                  
                  {/* Manual adjustments */}
                  <View style={styles.manualAdjustments}>
                    <View style={styles.manualStat}>
                      <Text style={styles.manualStatLabel}>Held:</Text>
                      <TouchableOpacity onPress={() => handleManualOffset(subject.id, -1, 0)} hitSlop={8}>
                        <Ionicons name="remove-circle-outline" size={20} color={Colors.dark.textMuted} />
                      </TouchableOpacity>
                      <Text style={styles.manualStatValue}>{displayHeld}</Text>
                      <TouchableOpacity onPress={() => handleManualOffset(subject.id, 1, 0)} hitSlop={8}>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.dark.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.manualStat}>
                      <Text style={styles.manualStatLabel}>Attended:</Text>
                      <TouchableOpacity onPress={() => handleManualOffset(subject.id, 0, -1)} hitSlop={8}>
                        <Ionicons name="remove-circle-outline" size={20} color={Colors.dark.textMuted} />
                      </TouchableOpacity>
                      <Text style={styles.manualStatValue}>{displayAttended}</Text>
                      <TouchableOpacity onPress={() => handleManualOffset(subject.id, 0, 1)} hitSlop={8}>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.dark.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.subjectActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingSubjectId(subject.id);
                      setEditingSubjectName(subject.name);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.dark.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSubject(subject.id, subject.name)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.dark.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
        })}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    marginRight: Spacing.md,
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
    paddingBottom: Spacing['4xl'],
  },
  description: {
    fontSize: Typography.size.base,
    color: Colors.dark.textMuted,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.base,
    letterSpacing: Typography.letterSpacing.wide,
  },
  addSubjectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
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
});
