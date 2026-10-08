import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabase } from '../lib/database';
import { colors } from '../lib/theme';
import SyncGate from '../lib/SyncGate';
import BoutonOutils from '../lib/BoutonOutils';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SyncGate onReady={initDatabase}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.surface,
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recette', headerRight: () => <BoutonOutils style={null} /> }} />
      </Stack>
    </SyncGate>
  );
}
