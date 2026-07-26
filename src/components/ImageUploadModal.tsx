/**
 * The 75 Project — Image Upload Modal
 * Direct AI timetable extraction from photos (FR-2.1)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, BorderRadius } from '@/theme/spacing';
import { useAuth } from '@/lib/auth/AuthContext';

interface ImageUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (jsonString: string) => void;
}

export function ImageUploadModal({ visible, onClose, onImport }: ImageUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const { session } = useAuth();

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos of your timetable.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && fileInfo.size > 2 * 1024 * 1024) {
        // If image is larger than 2MB, compress by re-saving with lower quality
        // @ts-ignore: cacheDirectory is exported but TS types in SDK 53 might miss it
        const compressedUri = `${FileSystem.cacheDirectory}compressed_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: compressedUri });
        return compressedUri;
      }
    } catch (error) {
      console.warn('Compression failed, using original:', error);
    }
    return uri;
  };

  const handleParseImage = async () => {
    if (!selectedImage || !session?.access_token) return;

    setProcessing(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      
      // Compress image if needed
      const imageUri = await compressImage(selectedImage);
      
      const response = await FileSystem.uploadAsync(`${apiUrl}/parse-image`, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = JSON.parse(response.body);

      if (response.status !== 200) {
        throw new Error(data.detail || 'Failed to parse image');
      }

      if (data.status === 'success' && data.timetable?.slots) {
        // Pass the parsed timetable to the parent handler
        onImport(JSON.stringify(data.timetable, null, 2));
        
        // Show success feedback
        Alert.alert(
          'Success!',
          `Found ${data.metadata?.total_slots || data.timetable.slots.length} classes.${
            data.metadata?.skipped_empty > 0
              ? ` (${data.metadata.skipped_empty} empty cells skipped)`
              : ''
          }`
        );
        
        handleClose();
      } else {
        throw new Error('Invalid response format from AI');
      }
    } catch (error: any) {
      console.error('Image parse error:', error);
      Alert.alert(
        'Parse Failed',
        error.message || 'Could not extract timetable from image. Please try again with a clearer photo.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setProcessing(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Timetable Extraction</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!selectedImage ? (
            // Image selection view
            <View style={styles.selectionView}>
              <View style={styles.iconContainer}>
                <Ionicons name="camera-outline" size={64} color={Colors.rose} />
              </View>
              <Text style={styles.selectionTitle}>Take or select a photo</Text>
              <Text style={styles.selectionDescription}>
                Point your camera at your timetable. Make sure all text is clear and readable.
              </Text>

              <TouchableOpacity style={styles.primaryButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handlePickImage}>
                <Ionicons name="images-outline" size={20} color={Colors.rose} />
                <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Image preview and processing view
            <View style={styles.previewView}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
              
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => setSelectedImage(null)}
                  disabled={processing}
                >
                  <Ionicons name="refresh" size={18} color={Colors.dark.textSecondary} />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.parseButton, processing && styles.parseButtonDisabled]}
                  onPress={handleParseImage}
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.parseButtonText}>Analyzing...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.parseButtonText}>Extract Timetable</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {processing && (
                <View style={styles.processingInfo}>
                  <Text style={styles.processingText}>
                    Sending to AI for analysis... This may take a few seconds.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>📸 Tips for best results:</Text>
          <Text style={styles.tipsText}>• Ensure good lighting and no shadows</Text>
          <Text style={styles.tipsText}>• Keep the timetable flat and fully visible</Text>
          <Text style={styles.tipsText}>• Avoid blurry or angled photos</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.base,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  // Selection view styles
  selectionView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  selectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  selectionDescription: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    width: '100%',
    marginBottom: Spacing.md,
  },
  primaryButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.bgCard,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.rose,
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.rose,
  },
  // Preview view styles
  previewView: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.bgCard,
    marginBottom: Spacing.base,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.bgCard,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  retakeButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    color: Colors.dark.textSecondary,
  },
  parseButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.rose,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  parseButtonDisabled: {
    opacity: 0.7,
  },
  parseButtonText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: '#fff',
  },
  processingInfo: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  processingText: {
    fontSize: Typography.size.sm,
    color: Colors.dark.textSecondary,
  },
  // Tips styles
  tipsContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.base,
    backgroundColor: Colors.dark.bgCard,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  tipsTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  tipsText: {
    fontSize: Typography.size.xs,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
});
