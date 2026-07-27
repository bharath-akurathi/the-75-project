import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { ImageUploadModal } from './ImageUploadModal';
import * as ImagePicker from 'expo-image-picker';

// Mock dependencies
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Fix for React error reporting in test environment
if (typeof window !== 'undefined') {
  window.dispatchEvent = jest.fn();
} else {
  (globalThis as any).window = { dispatchEvent: jest.fn() };
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'Base64' },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/lib/theme/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      primary: '#f00',
      border: '#222',
      danger: '#f00',
    },
    isDark: true,
  }),
}));

jest.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
  }),
}));

const mockOnClose = jest.fn();
const mockOnImport = jest.fn();

describe('ImageUploadModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', async () => {
    await render(
      <ImageUploadModal
        visible={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );
    expect(screen.getByText('AI Timetable Extraction')).toBeTruthy();
  });

  it('requests permissions and opens gallery on gallery press', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://test-image.jpg' }],
    });

    await render(
      <ImageUploadModal
        visible={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    fireEvent.press(screen.getByText('Choose from Gallery'));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  it('requests permissions and opens camera on camera press', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://test-image.jpg' }],
    });

    await render(
      <ImageUploadModal
        visible={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    fireEvent.press(screen.getByText('Take Photo'));

    await waitFor(() => {
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
  });
});
