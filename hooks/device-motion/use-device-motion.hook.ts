import { Gyroscope } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

const DT = 0.008;
const SENSITIVITY = 3;
const DECAY = Math.pow(0.4, DT);
const MAX_TILT = 1;

export function useDeviceMotionTilt() {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const accX = useRef(0);
  const accY = useRef(0);

  useEffect(() => {
    Gyroscope.setUpdateInterval(8);
    const sub = Gyroscope.addListener(({ x, y }) => {
      accX.current = Math.max(-MAX_TILT, Math.min(MAX_TILT,
        (accX.current + y * DT * SENSITIVITY) * DECAY));
      accY.current = Math.max(-MAX_TILT, Math.min(MAX_TILT,
        (accY.current + x * DT * SENSITIVITY) * DECAY));
      tiltX.value = accX.current;
      tiltY.value = accY.current;
    });
    return () => sub.remove();
  }, [tiltX, tiltY]);

  return { tiltX, tiltY };
}
