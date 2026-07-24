/**
 * The 75 Project — Logo Component
 * SVG recreation of the logo from logo.svg
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 80 }: LogoProps) {
  const scale = size / 100;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Top outline pill (clipped to show only top portion) */}
      <View style={[styles.topClip, {
        width: size,
        height: size * 0.4,
      }]}>
        <View style={[styles.pillOutline, {
          width: 40 * scale,
          height: 80 * scale,
          borderRadius: 20 * scale,
          borderWidth: 4 * scale,
          top: 10 * scale,
          left: 30 * scale,
        }]} />
      </View>

      {/* Bottom gradient pill (clipped to show only bottom portion) */}
      <View style={[styles.bottomClip, {
        width: size,
        height: size * 0.6,
        top: size * 0.4,
      }]}>
        <View style={[styles.pillGradient, {
          width: 40 * scale,
          height: 80 * scale,
          borderRadius: 20 * scale,
          top: (10 - 40) * scale,
          left: 30 * scale,
        }]} />
      </View>

      {/* Laser threshold line */}
      <View style={[styles.laserLine, {
        top: size * 0.33,
        left: size * 0.24,
        width: size * 0.52,
        height: 2.5 * scale,
        transform: [{ rotate: '-6deg' }],
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  topClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  bottomClip: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  pillOutline: {
    position: 'absolute',
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  pillGradient: {
    position: 'absolute',
    backgroundColor: Colors.rose, // Simplified from gradient — main brand color
  },
  laserLine: {
    position: 'absolute',
    backgroundColor: '#F43F5E',
    borderRadius: 2,
  },
});
