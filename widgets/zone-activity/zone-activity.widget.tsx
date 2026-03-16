/**
 * Live Activity layout for zone presence.
 *
 * Shown on the Lock Screen banner and Dynamic Island while the user is
 * physically inside a Szpont zone. Displays the zone name and a hint
 * that people they liked may approach them.
 */

import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

/**
 * Props pushed to the Live Activity on start / update.
 * Translations are resolved at call time and passed in as strings since
 * the widget JS runtime has no access to React context or i18n.
 */
type ZoneActivityProps = {
  zoneName: string;
  hint: string;
};

/** Live Activity component — must use the `'widget'` directive. */
const ZoneActivity = (props: ZoneActivityProps) => {
  'widget';

  return {
    // Lock Screen / Notification Center banner
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle('#FFFFFF')]}>
          {props.zoneName}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle('#FFFFFFB3')]}>
          {props.hint}
        </Text>
      </VStack>
    ),

    // Dynamic Island – compact pill (leading side)
    compactLeading: <Image systemName="mappin.circle.fill" color="#FF375F" />,

    // Dynamic Island – compact pill (trailing side)
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>
        {props.zoneName}
      </Text>
    ),

    // Dynamic Island – minimal (other app owns the island)
    minimal: <Image systemName="mappin.circle.fill" color="#FF375F" />,

    // Dynamic Island – expanded leading
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Image systemName="mappin.circle.fill" color="#FF375F" />
      </VStack>
    ),

    // Dynamic Island – expanded trailing
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle('#FFFFFF')]}>
          {props.zoneName}
        </Text>
      </VStack>
    ),

    // Dynamic Island – expanded bottom
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 12, bottom: 12 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#FFFFFFB3')]}>
          {props.hint}
        </Text>
      </VStack>
    ),
  };
};

export default createLiveActivity('ZoneActivity', ZoneActivity);
