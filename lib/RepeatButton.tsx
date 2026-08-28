import { useEffect, useRef } from 'react';
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';

// Rythme de la répétition : un appui bref agit au relâchement, un appui
// maintenu enchaîne des ticks de plus en plus rapprochés.
const HOLD_DELAY = 300;      // ms avant le démarrage de la répétition
const START_INTERVAL = 150;  // ms entre les 2 premiers ticks
const MIN_INTERVAL = 40;     // ms : vitesse maximale
const ACCEL = 0.85;          // facteur de resserrement à chaque tick

/** Le pas est multiplié après un maintien prolongé (300 g → 0 en un geste) */
function multiplierForTick(tick: number): number {
  if (tick < 8) return 1;
  if (tick < 20) return 2;
  return 5;
}

interface RepeatButtonProps {
  /** Appelé à chaque tick ; `multiplier` grandit quand le doigt reste appuyé */
  onPress: (multiplier: number) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
}

export function RepeatButton({ onPress, style, disabled, children }: RepeatButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef(0);
  const interval = useRef(START_INTERVAL);
  const repeated = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function schedule(delay: number) {
    timer.current = setTimeout(() => {
      repeated.current = true;
      tick.current += 1;
      onPressRef.current(multiplierForTick(tick.current));
      interval.current = Math.max(MIN_INTERVAL, interval.current * ACCEL);
      schedule(interval.current);
    }, delay);
  }

  function handlePressIn() {
    if (disabled) return;
    tick.current = 0;
    interval.current = START_INTERVAL;
    repeated.current = false;
    schedule(HOLD_DELAY);
  }

  // Appui bref : rien ne s'est répété, on applique un pas simple
  function handlePress() {
    if (!repeated.current) onPressRef.current(1);
  }

  useEffect(() => stop, []);

  return (
    <TouchableOpacity
      style={style}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={stop}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}
