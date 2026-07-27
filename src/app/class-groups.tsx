import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius, Shadow } from '@/lib/theme/tokens';
import { supabase } from '@/lib/auth/supabase';
import { useSQLiteContext } from 'expo-sqlite';

/**
 * Class Groups Screen (FR-4.2)
 * Manage shared timetables via 6-character shortcodes.
 */
export default function ClassGroupsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const db = useSQLiteContext();
  
  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Find the local student ID
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('auth_id', userData.user.id)
        .single();
        
      if (!student) return;

      // Fetch joined groups via class_group_members
      const { data: memberships, error } = await supabase
        .from('class_group_members')
        .select(`
          role,
          class_groups (
            id,
            name,
            share_code
          )
        `)
        .eq('student_id', student.id);

      if (error) {
        console.error('Error fetching groups:', error);
      } else if (memberships) {
        // Also fetch member counts for each group
        const groupsWithCounts = await Promise.all(memberships.map(async (m: any) => {
          const { count } = await supabase
            .from('class_group_members')
            .select('id', { count: 'exact', head: true })
            .eq('class_group_id', m.class_groups.id);
            
          return {
            id: m.class_groups.id,
            name: m.class_groups.name,
            code: m.class_groups.share_code,
            role: m.role,
            members: count || 1,
          };
        }));
        setMyGroups(groupsWithCounts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleJoin = async () => {
    if (joinCode.length !== 6) return;
    setIsJoining(true);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not logged in");

      const response = await fetch(`${API_URL}/class-group/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({ share_code: joinCode })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.detail || 'Failed to join group');
      }

      Alert.alert('Success', 'Joined class group successfully!');
      setJoinCode('');
      await loadGroups();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      Alert.alert('Validation Error', 'Please enter a group name');
      return;
    }
    
    setIsCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not logged in");

      // We need the current semester ID
      const currentSem = await db.getFirstAsync<{ id: string }>(`SELECT id FROM semesters WHERE is_active = 1`);
      if (!currentSem) throw new Error("No active semester found locally");

      const response = await fetch(`${API_URL}/class-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({ name: createName, semester_id: currentSem.id })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.detail || 'Failed to create group');
      }

      Alert.alert('Success', `Group created! Share Code: ${resData.share_code}`);
      setCreateName('');
      await loadGroups();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Class Groups</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Join a group to automatically sync timetable changes, cancellations, and day swaps with your classmates (FR-4.2).
        </Text>

        {/* Join Group Section */}
        <View style={[styles.joinCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, Shadow.sm]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Join a Group</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[
                styles.codeInput,
                { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }
              ]}
              placeholder="6-digit code"
              placeholderTextColor={colors.textTertiary}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: joinCode.length !== 6 || isJoining ? 0.5 : 1 }]}
              disabled={joinCode.length !== 6 || isJoining}
              onPress={handleJoin}
            >
              {isJoining ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.joinButtonText, { color: colors.textInverse }]}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Group Section */}
        <View style={[styles.joinCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: Spacing.md }, Shadow.sm]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Create a Group</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[
                styles.codeInput,
                { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }
              ]}
              placeholder="e.g. CSE Section A"
              placeholderTextColor={colors.textTertiary}
              value={createName}
              onChangeText={setCreateName}
            />
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isCreating ? 0.5 : 1 }]}
              disabled={isCreating}
              onPress={handleCreate}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.joinButtonText, { color: colors.textInverse }]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: Spacing.xl }]}>
          MY GROUPS
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : myGroups.length === 0 ? (
          <Text style={[styles.description, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl }]}>
            You haven't joined any class groups yet.
          </Text>
        ) : (
          myGroups.map((group) => (
            <View
              key={group.id}
              style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, Shadow.sm]}
            >
              <View style={styles.groupHeader}>
                <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                {group.role === 'admin' && (
                  <View style={[styles.adminBadge, { backgroundColor: colors.accentLight }]}>
                    <Text style={[styles.adminBadgeText, { color: colors.accent }]}>Class Rep</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.groupDetails}>
                <View>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Share Code</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{group.code}</Text>
                </View>
                <View>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Members</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{group.members}</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.manageButton, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.manageButtonText, { color: colors.textSecondary }]}>
                  {group.role === 'admin' ? 'Manage Settings' : 'View Details'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}

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
  joinCard: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.base,
  },
  cardTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  joinRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    height: 48,
    ...Typography.body,
    letterSpacing: 1,
    fontWeight: '600',
  },
  joinButton: {
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.md,
    height: 48,
  },
  joinButtonText: { ...Typography.button },
  sectionTitle: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  groupCard: {
    padding: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  groupName: {
    ...Typography.h2,
    flex: 1,
    marginRight: Spacing.sm,
  },
  adminBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  adminBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  groupDetails: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  detailLabel: {
    ...Typography.caption,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  manageButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  manageButtonText: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
