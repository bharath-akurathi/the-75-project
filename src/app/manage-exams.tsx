import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { getExamPeriods, addExamPeriod, deleteExamPeriod, type ExamPeriod } from '@/database/queries';
import { formatDate, parseDate, formatDateDisplay } from '@/utils/dateHelpers';

export default function ManageExamsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [exams, setExams] = useState<ExamPeriod[]>([]);
  
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadExams = useCallback(async () => {
    const data = await getExamPeriods(db);
    setExams(data);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadExams();
    }, [loadExams])
  );

  const handleAdd = async () => {
    if (!name.trim()) return;
    if (startDate > endDate) {
      Alert.alert('Invalid Dates', 'Start date must be before or equal to the end date.');
      return;
    }
    await addExamPeriod(db, name.trim(), formatDate(startDate), formatDate(endDate));
    setName('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadExams();
  };

  const handleDelete = async (id: number) => {
    await deleteExamPeriod(db, id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadExams();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exam Modes</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.description}>
          During an exam phase, attendance tracking is paused so you can focus on studying.
        </Text>

        {/* Add New Exam */}
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>Add Exam Phase</Text>
          <TextInput
            style={styles.input}
            placeholder="Exam Name (e.g. Midterms)"
            placeholderTextColor={Colors.dark.textMuted}
            value={name}
            onChangeText={setName}
          />
          
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(!showStartPicker)}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{formatDateDisplay(startDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(!showEndPicker)}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>{formatDateDisplay(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onValueChange={(_e, d) => {
                  if (Platform.OS === 'android') setShowStartPicker(false);
                  if (d) setStartDate(d);
                }}
              />
            </View>
          )}

          {showEndPicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={endDate}
                mode="date"
                minimumDate={startDate}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onValueChange={(_e, d) => {
                  if (Platform.OS === 'android') setShowEndPicker(false);
                  if (d) setEndDate(d);
                }}
              />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.addButton, !name.trim() && styles.addButtonDisabled]} 
            onPress={handleAdd}
            disabled={!name.trim()}
          >
            <Text style={styles.addButtonText}>Create Exam Phase</Text>
          </TouchableOpacity>
        </View>

        {/* Existing Exams */}
        <Text style={styles.sectionTitle}>Active Phases</Text>
        {exams.length === 0 ? (
          <Text style={styles.emptyText}>No exam phases configured.</Text>
        ) : (
          exams.map(exam => (
            <View key={exam.id} style={styles.examCard}>
              <View style={styles.examInfo}>
                <Text style={styles.examName}>{exam.name}</Text>
                <Text style={styles.examDates}>
                  {formatDateDisplay(parseDate(exam.start_date))} - {formatDateDisplay(parseDate(exam.end_date))}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(exam.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={Colors.rose} />
              </TouchableOpacity>
            </View>
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
  addCard: {
    backgroundColor: Colors.dark.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.base,
    letterSpacing: Typography.letterSpacing.wide,
  },
  input: {
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.dark.text,
    fontSize: Typography.size.base,
    marginBottom: Spacing.base,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.base,
  },
  dateButton: {
    flex: 1,
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  dateLabel: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textMuted,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: Typography.size.base,
    color: Colors.amber,
    fontWeight: Typography.weight.medium,
  },
  pickerContainer: {
    backgroundColor: Colors.dark.bgElevated,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
    overflow: 'hidden',
  },
  addButton: {
    backgroundColor: Colors.amber,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#000',
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.base,
  },
  emptyText: {
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.bgCard,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.sm,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: Typography.size.base,
    color: Colors.dark.text,
    fontWeight: Typography.weight.medium,
    marginBottom: 4,
  },
  examDates: {
    fontSize: Typography.size.sm,
    color: Colors.amber,
  },
});
