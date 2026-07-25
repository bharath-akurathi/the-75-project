/**
 * The 75 Project — Logo Component
 * SVG recreation of the logo from logo.svg
 */

import React from 'react';
import { View, useColorScheme } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, ClipPath, Polygon, Rect, Line } from 'react-native-svg';
import { Colors } from '@/theme/colors';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 80 }: LogoProps) {
  const colorScheme = useColorScheme();
  const strokeColor = colorScheme === 'light' ? Colors.light.text : Colors.dark.text;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="v2Grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={Colors.rose} />
            <Stop offset="100%" stopColor={Colors.amber} />
          </LinearGradient>
          <ClipPath id="v2Bottom">
            <Polygon points="0 46, 100 26, 100 100, 0 100" />
          </ClipPath>
          <ClipPath id="v2Top">
            <Polygon points="0 0, 100 0, 100 20, 0 40" />
          </ClipPath>
        </Defs>
        
        <Rect x="30" y="10" width="40" height="80" rx="20" fill="none" stroke={strokeColor} strokeWidth="4" clipPath="url(#v2Top)" />
        
        <Rect x="30" y="10" width="40" height="80" rx="20" fill="url(#v2Grad)" clipPath="url(#v2Bottom)" />
        
        {/* Laser Threshold */}
        <Line x1="24" y1="38.2" x2="76" y2="27.8" stroke={Colors.rose} strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
