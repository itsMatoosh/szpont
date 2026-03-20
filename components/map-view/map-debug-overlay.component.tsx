import { StyleSheet, Text, View } from 'react-native';

import { type DebugOverlayData } from '@/components/map-view/map-view.util';

interface MapDebugOverlayProps {
  debugOverlay: DebugOverlayData;
}

/** Visual debug overlay showing marker boxes and collision viewport bounds. */
export function MapDebugOverlay({ debugOverlay }: MapDebugOverlayProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Viewport boundary */}
      <View
        style={{
          position: 'absolute',
          left: debugOverlay.viewport.left,
          top: debugOverlay.viewport.top,
          width: debugOverlay.viewport.width,
          height: debugOverlay.viewport.height,
          borderWidth: 2,
          borderColor: 'lime',
          borderStyle: 'dashed',
        }}
      />
      {/* Marker bounding boxes */}
      {debugOverlay.rects.map((rect: DebugOverlayData['rects'][number]) => (
        <View
          key={rect.name}
          style={{
            position: 'absolute',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderWidth: 1,
            borderColor: 'red',
            backgroundColor: 'rgba(255, 0, 0, 0.15)',
          }}
        >
          <Text style={{ color: 'red', fontSize: 8 }}>{rect.name}</Text>
        </View>
      ))}
    </View>
  );
}
