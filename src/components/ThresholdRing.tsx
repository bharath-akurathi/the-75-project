import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme/ThemeContext';
import { Typography, Spacing, Radius } from '@/lib/theme/tokens';
import Svg, { Circle } from 'react-native-svg';

interface ThresholdRingProps {
  percentage: number;
  threshold: number;
  size?: number;
  strokeWidth?: number;
}

/**
 * ThresholdRing component (FR-5.5)
 * Per-subject progress ring with a threshold marker.
 * Replaces the simple progress bar in Insights screen.
 */
export function ThresholdRing({
  percentage,
  threshold,
  size = 64,
  strokeWidth = 6,
}: ThresholdRingProps) {
  const { colors } = useTheme();

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.min(percentage, 1) * circumference;

  // Determine color based on threshold
  const isSafe = percentage >= threshold;
  const isWarning = !isSafe && percentage >= threshold - 0.03;
  const color = isSafe ? colors.safe : isWarning ? colors.warning : colors.danger;

  // Position for the threshold tick mark
  const thresholdAngle = threshold * 360 - 90; // -90 to start at top
  const tickX = size / 2 + (radius + strokeWidth) * Math.cos((thresholdAngle * Math.PI) / 180);
  const tickY = size / 2 + (radius + strokeWidth) * Math.sin((thresholdAngle * Math.PI) / 180);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          stroke={colors.surfaceElevated}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Progress fill */}
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
        {/* Threshold tick mark */}
        <Circle
          cx={tickX}
          cy={tickY}
          r={2}
          fill={colors.danger}
        />
      </Svg>
      {/* Center text */}
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[{ color: colors.text, fontSize: size * 0.28, fontWeight: '700' }]}>
          {Math.round(percentage * 100)}%
        </Text>
      </View>
    </View>
  );
}
