// components/primitives/Barcode.tsx
// Composant code-barres purement vectoriel (View uniquement, zéro dépendance npm)

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ─── Générateur de barres déterministe ───────────────────────────────────────

interface Bar { width: number; dark: boolean; }

function codeToBars(code: string): Bar[] {
  const bars: Bar[] = [];

  // Garde de début : 1 0 1
  bars.push({ width: 2, dark: true }, { width: 1, dark: false }, { width: 2, dark: true }, { width: 1, dark: false });

  for (let i = 0; i < code.length; i++) {
    const v = ((code.charCodeAt(i) * 37 + i * 17) >>> 0) % 256;
    bars.push({ width: 1 + (v & 0x03),        dark: true  });
    bars.push({ width: 1 + ((v >> 2) & 0x01), dark: false });
    bars.push({ width: 1 + ((v >> 3) & 0x03), dark: true  });
    bars.push({ width: 1 + ((v >> 5) & 0x01), dark: false });
  }

  // Garde de fin
  bars.push({ width: 1, dark: false }, { width: 2, dark: true }, { width: 1, dark: false }, { width: 2, dark: true });

  return bars;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BarcodeProps {
  code:             string;
  width?:           number;
  height?:          number;
  showLabel?:       boolean;
  backgroundColor?: string;
  foregroundColor?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const Barcode = memo(function Barcode({
  code,
  width           = 240,
  height          = 72,
  showLabel       = true,
  backgroundColor = '#FFFFFF',
  foregroundColor = '#000000',
}: BarcodeProps) {
  const bars       = codeToBars(code);
  const totalUnits = bars.reduce((s, b) => s + b.width, 0);
  const unitW      = width / totalUnits;

  return (
    <View style={[s.root, { width, backgroundColor }]}>
      <View style={[s.track, { height }]}>
        {bars.map((bar, i) => (
          <View
            key={i}
            style={{
              width:           bar.width * unitW,
              height,
              backgroundColor: bar.dark ? foregroundColor : backgroundColor,
            }}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={[s.label, { color: foregroundColor }]}>
          {code.toUpperCase()}
        </Text>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  root:  { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  track: { flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden' },
  label: { fontSize: 9, letterSpacing: 2.5, marginTop: 8 },
});

export default Barcode;
