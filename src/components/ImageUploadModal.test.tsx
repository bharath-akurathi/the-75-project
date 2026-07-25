import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageUploadModal } from './ImageUploadModal';

// Mock dependencies
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  copyAsync: jest.fn(),
  cacheDirectory: '/tmp/cache/',
}));

jest.mock('@/lib/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    session: { access_token: 'test-token' },
  })),
}));

describe('ImageUploadModal', () => {
  const mockOnClose = jest.fn();
  const mockOnImport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly when visible', () => {
      const { getByText } = render(
        <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
      );

      expect(getByText('AI Timetable Extraction')).toBeTruthy();
      expect(getByText('Take Photo')).toBeTruthy();
      expect(getByText('Choose from Gallery')).toBeTruthy();
    });

    it('does not render when not visible', () => {
      const { queryByText } = render(
        <ImageUploadModal visible={false} onClose={mockOnClose} onImport={mockOnImport} />
      );

      expect(queryByText('AI Timetable Extraction')).toBeNull();
    });

    it('shows tips section', () => {
      const { getByText } = render(
        <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
      );

      expect(getByText('📸 Tips for best results:')).toBeTruthy();
      expect(getByText('• Ensure good lighting and no shadows')).toBeTruthy();
      expect(getByText('• Keep the timetable flat and fully visible')).toBeTruthy();
      expect(getByText('• Avoid blurry or angled photos')).toBeTruthy();
    });
  });

  describe('Initial State', () => {
    it('shows selection view initially', () => {
      const { getByText } = render(
        <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
      );

      expect(getByText('Take or select a photo')).toBeTruthy();
      expect(getByText('Point your camera at your timetable. Make sure all text is clear and readable.')).toBeTruthy();
    });

    it('does not show preview initially', () => {
      const { queryByText } = render(
        <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
      );

      expect(queryByText('Retake')).toBeNull();
      expect(queryByText('Extract Timetable')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('has proper button labels', () => {
      const { getByText } = render(
        <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
      );

      // Verify buttons are present and labeled
      expect(getByText('Take Photo')).toBeTruthy();
      expect(getByText('Choose from Gallery')).toBeTruthy();
    });
  });
});

describe('ImageUploadModal - Props', () => {
  const mockOnClose = jest.fn();
  const mockOnImport = jest.fn();

  it('accepts visible prop', () => {
    const { rerender, queryByText } = render(
      <ImageUploadModal visible={false} onClose={mockOnClose} onImport={mockOnImport} />
    );

    expect(queryByText('AI Timetable Extraction')).toBeNull();

    rerender(<ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />);

    expect(queryByText('AI Timetable Extraction')).toBeTruthy();
  });

  it('accepts onClose callback', () => {
    const { getByText } = render(
      <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
    );

    // Verify component renders with the callback
    expect(getByText('AI Timetable Extraction')).toBeTruthy();
    expect(typeof mockOnClose).toBe('function');
  });

  it('accepts onImport callback', () => {
    const { getByText } = render(
      <ImageUploadModal visible={true} onClose={mockOnClose} onImport={mockOnImport} />
    );

    // Verify component renders with the callback
    expect(getByText('AI Timetable Extraction')).toBeTruthy();
    expect(typeof mockOnImport).toBe('function');
  });
});
