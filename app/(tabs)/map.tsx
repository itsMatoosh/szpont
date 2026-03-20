import { StyleSheet, View } from 'react-native';

import { MapView } from '@/components/map-view/map-view.component';

/** Map tab: full-screen Mapbox with no auxiliary sheet. */
export default function MapTabScreen() {
  return (
    <View style={styles.container}>
      <MapView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
