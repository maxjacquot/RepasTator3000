import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getRooms,
  getRoomTaskCounts,
  type Room,
} from '../database';
import { colors, fonts, typography, spacing, radii, shadows } from '../theme';
import { RoomDetailModal } from '../RoomDetailModal';

// ─── Plan de maison — coordonnées virtuelles 800×500 ──────────
//
//  Grille x : 0, 200, 400, 500, 600, 800
//  Grille y : 0, 100, 200, 300, 350, 500
//  Pas de zone extérieure — couverture totale 0→800 × 0→500
//
//  y=0   ┌──────────────┬───────────────────┬──────────────────────────────┐
//        │  Scellier    │                   │                              │
//        │   (w=200)    │  Cuisine (w=300)  │       Chambre (w=300)        │
//  y=100 ├──────────────┤                   │                              │
//        │    WC        │                   │                              │
//  y=200 │   (w=200)    ├──────────┬────────┼──────────┬───────────────────┤
//        ├──────────────┤          │        │          │                   │
//        │  Hall (w=400)│   SDB    │ Coul.  │          │ Dressing (w=200)  │
//  y=300 ├──────────────┴──────────┤        │          │                   │
//        │ Salon  │    SAM (w=300) │ Coul.  │          │ Dressing (w=200)  │
//  y=350 │ (w=200)│                ├────────┴──────────┴───────────────────┤
//        │        │                │           Bureau (w=300)              │
//  y=500 └────────┴────────────────┴───────────────────────────────────────┘
//         x=0    x=200   x=400  x=500  x=600                          x=800
//
//  Couverture totale : chaque ligne y somme exactement à 800
//  Hall(x=0-400,y=200-300)   : WC↑  Cuisine↑  SDB→  Salon↓  SAM↓  ✓
//  Couloir(x=500-600,y=200-350): Chambre↑  SDB←  SAM←(droite)  Dressing→  Bureau↓  ✓
//  Bureau(x=500-800,y=350-500) : Couloir↑  Dressing↑  SAM←  ✓

const PLAN_VW = 800;
const PLAN_VH = 800;

type FloorRoom = { name: string; x: number; y: number; w: number; h: number };

const FLOOR_PLAN: FloorRoom[] = [
  // Colonne gauche  x=0-200
  { name: 'Scellier',       x: 0,   y: 0,   w: 200, h: 160 },
  { name: 'WC',             x: 0,   y: 160, w: 200, h: 160 },
  // Hall (x=0-300) : WC↑  Cuisine↑  SDB→  Salon↓  SAM↓
  { name: 'Hall',           x: 0,   y: 320, w: 300, h: 160 },
  // Zone centrale  x=200-500
  { name: 'Cuisine',        x: 200, y: 0,   w: 300, h: 320 },
  { name: 'SDB',            x: 300, y: 320, w: 200, h: 160 },
  // Couloir (x=500-600, y=320-560) : Chambre↑  SDB←  SAM←(droite)  Dressing→  Bureau↓
  { name: 'Couloir',        x: 500, y: 320, w: 100, h: 240 },
  // Zone privée droite  x=500-800
  { name: 'Chambre',        x: 500, y: 0,   w: 300, h: 320 },
  { name: 'Dressing',       x: 600, y: 320, w: 200, h: 240 },
  // Rangée du bas
  { name: 'Salon',          x: 0,   y: 480, w: 200, h: 320 },
  { name: 'Salle à manger', x: 200, y: 480, w: 300, h: 320 },
  // Bureau (x=500-800, y=560-800) : Couloir↑  Dressing↑  SAM←
  { name: 'Bureau',         x: 500, y: 560, w: 300, h: 240 },
];

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// ─── Plan interactif ──────────────────────────────────────────

type RoomWithCounts = Room & { total: number; done: number };

interface FloorPlanViewProps {
  rooms: RoomWithCounts[];
  containerWidth: number;
  onRoomPress: (room: Room) => void;
}

function FloorPlanView({ rooms, containerWidth, onRoomPress }: FloorPlanViewProps) {
  const scale = containerWidth / PLAN_VW;
  const planHeight = PLAN_VH * scale;

  const roomByName = new Map<string, RoomWithCounts>();
  rooms.forEach((r) => roomByName.set(normalizeName(r.name), r));

  return (
    <View style={{ width: containerWidth, height: planHeight }}>
      {FLOOR_PLAN.map((pos) => {
        const room = roomByName.get(normalizeName(pos.name));
        const pw = pos.w * scale;
        const ph = pos.h * scale;
        const progress = room && room.total > 0 ? room.done / room.total : 0;
        const remaining = room ? room.total - room.done : 0;
        const roomColor = room?.color ?? colors.border;
        const isActive = !!room;

        const minDim = Math.min(pw, ph);
        const showIcon = minDim >= 36 && isActive;
        const iconSize = minDim >= 60 ? 20 : 14;
        const nameSize = pw < 48 ? 7 : pw < 68 ? 8 : pw < 100 ? 9 : 10;
        const displayName = pw < 44 ? pos.name.slice(0, 3) : pos.name;

        return (
          <TouchableOpacity
            key={pos.name}
            style={{
              position: 'absolute',
              left: pos.x * scale,
              top: pos.y * scale,
              width: pw,
              height: ph,
              backgroundColor: isActive ? roomColor + '20' : colors.surface,
              borderWidth: isActive ? 1.5 : 1,
              borderColor: isActive ? roomColor : colors.border,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
            }}
            onPress={() => isActive && onRoomPress(room!)}
            disabled={!isActive}
            activeOpacity={0.7}
          >
            {/* Barre de progression (depuis le bas) */}
            {isActive && room!.total > 0 && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${progress * 100}%` as any,
                  backgroundColor: roomColor + '30',
                }}
              />
            )}

            {showIcon && (
              <Text style={{ fontSize: iconSize, lineHeight: iconSize + 2 }}>{room!.icon}</Text>
            )}

            <Text
              numberOfLines={2}
              style={{
                fontSize: nameSize,
                fontWeight: '700',
                color: isActive ? roomColor : colors.border,
                textAlign: 'center',
                lineHeight: nameSize + 2,
                alignSelf: 'stretch',
              }}
            >
              {displayName}
            </Text>

            {isActive && room!.total > 0 && (
              <View
                style={{
                  backgroundColor: progress === 1 ? colors.success : roomColor,
                  borderRadius: 99,
                  paddingHorizontal: 3,
                  paddingVertical: 1,
                  minWidth: 14,
                  alignItems: 'center',
                  alignSelf: 'center',
                }}
              >
                <Text style={{ fontSize: 7, color: colors.surface, fontWeight: '700' }}>
                  {progress === 1 ? '✓' : remaining}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Panel principal ──────────────────────────────────────────

interface MaisonPanelProps {
  width: number;
  isFocused: boolean;
  focusKey: number;
}

export function MaisonPanel({ width, isFocused, focusKey }: MaisonPanelProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomWithCounts[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bodySize, setBodySize] = useState({ w: 0, h: 0 });

  const loadData = useCallback(() => {
    const allRooms = getRooms();
    setRooms(
      allRooms.map((r) => {
        const counts = getRoomTaskCounts(r.id);
        return { ...r, ...counts };
      })
    );
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, focusKey]);

  const totalTasks = rooms.reduce((acc, r) => acc + r.total, 0);
  const doneTasks = rooms.reduce((acc, r) => acc + r.done, 0);
  const globalProgress = totalTasks === 0 ? 0 : doneTasks / totalTasks;

  // Calcul du scale pour remplir l'espace disponible
  const pad = spacing.lg;
  const scaleW = bodySize.w > 0 ? (bodySize.w - pad * 2) / PLAN_VW : 0;
  const scaleH = bodySize.h > 0 ? (bodySize.h - pad * 2) / PLAN_VH : 0;
  const planScale = Math.min(scaleW, scaleH);
  const planWidth = PLAN_VW * planScale;

  return (
    <View style={[styles.root, { width }]} pointerEvents={isFocused ? 'auto' : 'none'}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>🏠</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Ma Maison</Text>
            <Text style={styles.headerSub}>
              {totalTasks === 0
                ? 'Aucune tâche en cours'
                : `${doneTasks}/${totalTasks} tâches terminées`}
            </Text>
          </View>
        </View>
        {totalTasks > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${globalProgress * 100}%` as any }]} />
          </View>
        )}
      </View>

      {/* Corps : plan centré */}
      <View
        style={styles.body}
        onLayout={(e) => setBodySize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {planScale > 0 && (
          <View style={styles.planWrapper}>
            <View style={styles.planCard}>
              <FloorPlanView
                rooms={rooms}
                containerWidth={planWidth}
                onRoomPress={(room) => setSelectedRoom(room)}
              />
            </View>
          </View>
        )}
      </View>

      {selectedRoom && (
        <RoomDetailModal
          visible
          room={selectedRoom}
          onClose={() => { setSelectedRoom(null); loadData(); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.house,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnText: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.surface,
    lineHeight: 32,
  },
  headerSub: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  headerBadgeDone: {
    backgroundColor: colors.success,
  },
  headerBadgeText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.full,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radii.full,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  planCard: {},

  // Pièces hors plan (styles conservés pour RoomDetailModal compat)
  chevron: {
    fontSize: 22,
    color: colors.textSecondary,
  },
});
