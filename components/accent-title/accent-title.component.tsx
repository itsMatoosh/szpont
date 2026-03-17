import { Text, View } from 'react-native';

const nunitoBold = { fontFamily: 'Nunito_700Bold' } as const;

/** 8 directional offsets that simulate a uniform text stroke via overlaid copies. */
const STROKE_OFFSETS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 0.7, y: 0.7 }, { x: -0.7, y: -0.7 }, { x: 0.7, y: -0.7 }, { x: -0.7, y: 0.7 },
];

const STROKE_WIDTH = 2;

/**
 * Renders a title with an inline accent phrase. When `outlined` is true,
 * 8 offset copies of the full text in the stroke color sit behind the fill
 * layer, creating a visible outline only around the lighter accent text.
 */
export function AccentTitle({ before, accent, after, large, outlined }: {
  before?: string;
  accent: string;
  after?: string;
  large?: boolean;
  outlined?: boolean;
}) {
  const sizeClass = large ? 'text-5xl' : 'text-4xl';
  const baseClass = `${sizeClass} font-bold text-center leading-tight`;

  return (
    <View>
      {outlined && STROKE_OFFSETS.map((o, i) => (
        <Text
          key={i}
          className={baseClass}
          style={[nunitoBold, { position: 'absolute', left: 0, right: 0, color: 'transparent', transform: [{ translateX: o.x * STROKE_WIDTH }, { translateY: o.y * STROKE_WIDTH }] }]}
        >
          {before}
          <Text style={{ color: '#000000' }}>{accent}</Text>
          {after}
        </Text>
      ))}
      <Text className={`text-foreground ${baseClass}`} style={nunitoBold}>
        {before}
        <Text className="text-accent">{accent}</Text>
        {after}
      </Text>
    </View>
  );
}
