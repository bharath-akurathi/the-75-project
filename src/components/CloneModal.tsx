import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { useAuth } from '@/lib/auth/AuthContext';

interface CloneModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => void;
}

export function CloneModal({ visible, onClose, onImport }: CloneModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();

  const handleClone = async () => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Share code must be exactly 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}/timetable/code/${code}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch timetable');
      }

      // Convert response back to a string so it can be handled by the existing JSON importer
      onImport(JSON.stringify(data.timetable, null, 2));
      setCode('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Clone Timetable</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Enter the 6-digit share code from your class group to instantly copy their timetable.
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            placeholder="e.g., AB12CD"
            placeholderTextColor={Colors.dark.textMuted}
            autoCapitalize="characters"
            maxLength={6}
          />

          <TouchableOpacity 
            style={[styles.button, (!code || code.length < 6 || loading) && styles.buttonDisabled]} 
            onPress={handleClone}
            disabled={!code || code.length < 6 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Clone Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.dark.bg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing['2xl'],
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  description: {
    fontSize: Typography.size.base,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  input: {
    backgroundColor: Colors.dark.bgElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: Typography.size.lg,
    color: Colors.dark.text,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: Spacing.xl,
    fontWeight: Typography.weight.bold,
  },
  button: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
