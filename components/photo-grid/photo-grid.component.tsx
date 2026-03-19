import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import {
  SortableGrid,
  SortableGridItem,
  type SortableGridRenderItemProps,
} from 'react-native-reanimated-dnd';

const COLS = 3;
const GAP = 8;
const TOTAL_SLOTS = 9;

/** A photo item the grid knows how to render and reorder. */
export interface GridPhoto {
  id: string;
  uri: string;
  position: number;
}

interface PhotoGridProps {
  photos: GridPhoto[];
  onAdd: (position: number) => void;
  onRemove: (photoId: string) => void;
  onReorder: (photoId: string, newPosition: number) => void;
  editable?: boolean;
}

/**
 * Draggable, reorderable 3×3 photo grid using a three-layer sandwich:
 *
 *   Layer 1 (bottom) — non-interactive empty-slot placeholders
 *   Layer 2 (middle) — SortableGrid containing only real photos
 *   Layer 3 (top)    — interactive empty-slot placeholders
 *
 * When a drag begins layer 3 hides (opacity 0 + pointerEvents none) so
 * the dragged photo renders above the bottom placeholders. When the drag
 * ends layer 3 reappears and becomes tappable again.
 */
export function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  onReorder,
  editable = true,
}: PhotoGridProps) {
  const sorted = useMemo(
    () => [...photos].sort((a, b) => a.position - b.position),
    [photos],
  );

  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const cellW =
    containerWidth > 0 ? (containerWidth - GAP * (COLS - 1)) / COLS : 0;
  const cellH = cellW * 1.5; // 2:3 aspect ratio

  const scheme = useColorScheme();
  const borderColor = scheme === 'dark' ? '#333' : '#CCC';

  const totalRows = Math.ceil(TOTAL_SLOTS / COLS);
  const gridHeight =
    cellH > 0 ? totalRows * cellH + (totalRows - 1) * GAP : 0;

  /** Positions that have no photo and should show the "+" placeholder. */
  const emptySlotPositions = useMemo(() => {
    const slots: number[] = [];
    for (let i = sorted.length; i < TOTAL_SLOTS; i++) slots.push(i);
    return slots;
  }, [sorted.length]);

  const handleDragStart = useCallback(
    (_id: string, _position: number) => setIsDragging(true),
    [],
  );

  /** Sync the photo's new grid position back to state and end drag mode. */
  const handleItemDrop = useCallback(
    (id: string, position: number) => {
      setIsDragging(false);
      const photo = sorted.find((p) => p.id === id);
      if (photo && photo.position !== position) {
        onReorder(photo.id, position);
      }
    },
    [sorted, onReorder],
  );

  const renderItem = useCallback(
    (props: SortableGridRenderItemProps<GridPhoto>) => {
      const { item, id, ...rest } = props;
      return (
        <SortableGridItem
          key={id}
          id={id}
          data={item}
          onDragStart={handleDragStart}
          onDrop={handleItemDrop}
          {...rest}
        >
          <View style={[styles.photoCell, { width: cellW, height: cellH }]}>
            <Image
              source={{ uri: item.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {editable && (
              <RNBounceable
                onPress={() => onRemove(item.id)}
                style={styles.removeBtn}
              >
                <View style={styles.removeBg}>
                  <Ionicons name="close" size={16} color="#fff" />
                </View>
              </RNBounceable>
            )}
          </View>
        </SortableGridItem>
      );
    },
    [cellW, cellH, editable, onRemove, handleDragStart, handleItemDrop],
  );

  /** Renders empty-slot cards at their absolute grid positions. */
  const renderEmptySlots = useCallback(
    (tappable: boolean) =>
      emptySlotPositions.map((slot) => {
        const col = slot % COLS;
        const row = Math.floor(slot / COLS);
        const x = col * (cellW + GAP);
        const y = row * (cellH + GAP);
        const positionStyle = {
          width: cellW,
          height: cellH,
          left: x,
          top: y,
          borderColor,
        };

        if (tappable) {
          return (
            <RNBounceable
              key={`empty-${slot}`}
              onPress={() => onAdd(sorted.length)}
              style={[styles.emptyCell, positionStyle]}
            >
              <Ionicons name="add" size={32} color={borderColor} />
            </RNBounceable>
          );
        }

        return (
          <View
            key={`empty-bg-${slot}`}
            style={[styles.emptyCell, positionStyle]}
          >
            <Ionicons name="add" size={32} color={borderColor} />
          </View>
        );
      }),
    [emptySlotPositions, cellW, cellH, borderColor, onAdd, sorted.length],
  );

  /** Force full remount when the set of photos changes. */
  const gridKey = sorted.map((p) => p.id).sort().join(',');

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{ height: gridHeight, overflow: 'visible' }}
    >
      {/* Layer 1 (bottom): non-tappable placeholders, only visible during drag */}
      {cellW > 0 && editable && (
        <View style={{ opacity: isDragging ? 1 : 0 }} pointerEvents="none">
          {renderEmptySlots(false)}
        </View>
      )}

      {/* Layer 2 (middle): SortableGrid with photos only */}
      {cellW > 0 && sorted.length > 0 && (
        <SortableGrid
          key={gridKey}
          data={sorted}
          renderItem={renderItem}
          dimensions={{
            columns: COLS,
            itemWidth: cellW,
            itemHeight: cellH,
            columnGap: GAP,
            rowGap: GAP,
          }}
          scrollEnabled={false}
          style={{ overflow: 'visible' }}
          contentContainerStyle={{ overflow: 'visible' }}
        />
      )}

      {/* Layer 3 (top): tappable placeholders — hidden during drag */}
      {cellW > 0 && editable && (
        <View
          style={[StyleSheet.absoluteFill, { opacity: isDragging ? 0 : 1 }]}
          pointerEvents={isDragging ? 'none' : 'box-none'}
        >
          {renderEmptySlots(true)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoCell: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  emptyCell: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  removeBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
