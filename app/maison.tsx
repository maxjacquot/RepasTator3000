import { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { colors } from '../lib/theme';
import { TabBar, type TabDef } from '../lib/TabBar';
import { MaisonPanel } from '../lib/panels/MaisonPanel';
import { MaisonCoursesPanel } from '../lib/panels/MaisonCoursesPanel';
import { MaisonTasksPanel } from '../lib/panels/MaisonTasksPanel';

const MAISON_TABS: TabDef[] = [
  { label: 'Courses', icon: '🛒', activeColor: colors.house },
  { label: 'Plan', icon: '🏠', activeColor: colors.house },
  { label: 'Tâches', icon: '✅', activeColor: colors.house },
];

export default function MaisonScreen() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(1); // Démarre sur le plan
  const [focusKey, setFocusKey] = useState(0);
  const translateX = useRef(new Animated.Value(-width)).current; // tab 1 = -width

  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  function switchTab(newTab: number) {
    if (newTab === activeTab) return;
    Animated.timing(translateX, {
      toValue: -newTab * width,
      duration: 260,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    setActiveTab(newTab);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={colors.house} />
      <View style={styles.container}>
        <Animated.View
          style={[styles.panelRow, { width: width * 3, transform: [{ translateX }] }]}
        >
          <MaisonCoursesPanel width={width} isFocused={activeTab === 0} focusKey={focusKey} />
          <MaisonPanel width={width} isFocused={activeTab === 1} focusKey={focusKey} />
          <MaisonTasksPanel width={width} isFocused={activeTab === 2} focusKey={focusKey} />
        </Animated.View>
        <TabBar tabs={MAISON_TABS} activeTab={activeTab} onSwitch={switchTab} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  panelRow: {
    flex: 1,
    flexDirection: 'row',
  },
});
