import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getRoomTasks,
  deleteRoom,
  addRoomTask,
  updateRoomTask,
  updateRoomTaskStatus,
  updateRoomTaskShoppingItems,
  deleteRoomTask,
  type Room,
  type RoomTask,
  type RoomTaskStatus,
  type RoomTaskPriority,
  type RoomShoppingItem,
} from './database';
import { colors, fonts, typography, spacing, radii, shadows } from './theme';

// ─── Config ───────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<RoomTaskPriority, { label: string; color: string }> = {
  high:   { label: 'Urgent',    color: '#E74C3C' },
  normal: { label: 'Normal',    color: colors.textSecondary },
  low:    { label: 'Plus tard', color: '#27AE60' },
};

const STATUS_ORDER: RoomTaskStatus[] = ['todo', 'preparing', 'in_progress', 'done'];
const STATUS_ICONS: Record<RoomTaskStatus, string> = {
  todo:        '○',
  preparing:   '◑',
  in_progress: '◕',
  done:        '✓',
};

// ─── Formulaire d'ajout / édition ─────────────────────────────

interface TaskFormProps {
  roomColor: string;
  initialTitle?: string;
  initialPriority?: RoomTaskPriority;
  initialNote?: string;
  submitLabel: string;
  onSave: (title: string, priority: RoomTaskPriority, note: string) => void;
  onCancel: () => void;
}

function TaskForm({ roomColor, initialTitle = '', initialPriority = 'normal', initialNote = '', submitLabel, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [priority, setPriority] = useState<RoomTaskPriority>(initialPriority);
  const [note, setNote] = useState(initialNote);

  return (
    <View style={formStyles.root}>
      <TextInput
        style={formStyles.titleInput}
        placeholder="Décrire la tâche..."
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
        autoFocus
        multiline
      />

      <Text style={formStyles.label}>Priorité</Text>
      <View style={formStyles.priorityRow}>
        {(['high', 'normal', 'low'] as RoomTaskPriority[]).map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          return (
            <TouchableOpacity
              key={p}
              style={[formStyles.priorityBtn, priority === p && { borderColor: cfg.color, backgroundColor: cfg.color + '18' }]}
              onPress={() => setPriority(p)}
            >
              <Text style={[formStyles.priorityLabel, priority === p && { color: cfg.color, fontWeight: typography.fontWeights.bold }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={formStyles.label}>Description (optionnel)</Text>
      <TextInput
        style={formStyles.noteInput}
        placeholder="Détails, dimensions, références..."
        placeholderTextColor={colors.textSecondary}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
      />

      <View style={formStyles.actions}>
        <TouchableOpacity style={formStyles.cancelBtn} onPress={onCancel}>
          <Text style={formStyles.cancelText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[formStyles.saveBtn, { backgroundColor: roomColor }, !title.trim() && formStyles.saveBtnDisabled]}
          onPress={() => title.trim() && onSave(title.trim(), priority, note.trim())}
          disabled={!title.trim()}
        >
          <Text style={formStyles.saveText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Section achats ───────────────────────────────────────────

interface ShoppingSectionProps {
  task: RoomTask;
  roomColor: string;
  onUpdate: () => void;
}

function ShoppingSection({ task, roomColor, onUpdate }: ShoppingSectionProps) {
  const [newItem, setNewItem] = useState('');
  const items: RoomShoppingItem[] = JSON.parse(task.shopping_items || '[]');

  function save(updated: RoomShoppingItem[]) {
    updateRoomTaskShoppingItems(task.id, updated);
    onUpdate();
  }

  function addItem() {
    const name = newItem.trim();
    if (!name) return;
    save([...items, { name, done: false }]);
    setNewItem('');
  }

  function toggleItem(index: number) {
    save(items.map((it, i) => i === index ? { ...it, done: !it.done } : it));
  }

  function removeItem(index: number) {
    save(items.filter((_, i) => i !== index));
  }

  const remaining = items.filter((i) => !i.done).length;

  return (
    <View style={shopStyles.root}>
      <Text style={shopStyles.title}>
        🛒 Achats
        {items.length > 0 && (
          <Text style={{ color: remaining > 0 ? roomColor : colors.success }}>
            {' '}· {remaining > 0 ? `${remaining} restant${remaining > 1 ? 's' : ''}` : 'tout acheté !'}
          </Text>
        )}
      </Text>

      {items.map((item, i) => (
        <View key={i} style={shopStyles.itemRow}>
          <TouchableOpacity
            style={[shopStyles.checkbox, item.done && { backgroundColor: colors.success, borderColor: colors.success }]}
            onPress={() => toggleItem(i)}
          >
            {item.done && <Text style={shopStyles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={[shopStyles.itemName, item.done && shopStyles.itemNameDone]} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity onPress={() => removeItem(i)} style={shopStyles.removeBtn}>
            <Text style={shopStyles.removeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={shopStyles.addRow}>
        <TextInput
          style={shopStyles.addInput}
          placeholder="Ajouter un article..."
          placeholderTextColor={colors.textSecondary}
          value={newItem}
          onChangeText={setNewItem}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[shopStyles.addBtn, { backgroundColor: roomColor }, !newItem.trim() && shopStyles.addBtnDisabled]}
          onPress={addItem}
          disabled={!newItem.trim()}
        >
          <Text style={shopStyles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Carte de tâche ───────────────────────────────────────────

interface TaskCardProps {
  task: RoomTask;
  roomColor: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (id: number, status: RoomTaskStatus) => void;
  onDelete: (id: number) => void;
  onShoppingUpdate: () => void;
  onEdited: () => void;
}

function TaskCard({ task, roomColor, expanded, onToggleExpand, onStatusChange, onDelete, onShoppingUpdate, onEdited }: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const currentIdx = STATUS_ORDER.indexOf(task.status);
  const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
  const isDone = task.status === 'done';
  const shopItems: RoomShoppingItem[] = JSON.parse(task.shopping_items || '[]');
  const shopRemaining = shopItems.filter((i) => !i.done).length;

  function handleSaveEdit(title: string, priority: RoomTaskPriority, note: string) {
    updateRoomTask(task.id, { title, priority, note });
    setEditing(false);
    onEdited();
  }

  return (
    <View style={[taskStyles.card, isDone && taskStyles.cardDone]}>
      <View style={taskStyles.mainRow}>
        <TouchableOpacity
          style={[taskStyles.statusBtn, isDone && { backgroundColor: colors.success, borderColor: colors.success }]}
          onPress={() => onStatusChange(task.id, nextStatus)}
        >
          <Text style={[taskStyles.statusIcon, isDone && { color: colors.surface }]}>
            {STATUS_ICONS[task.status]}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={taskStyles.body} onPress={onToggleExpand} activeOpacity={0.7}>
          <Text style={[taskStyles.taskTitle, isDone && taskStyles.taskTitleDone]}>{task.title}</Text>
          <View style={taskStyles.metaRow}>
            {task.priority !== 'normal' && (
              <Text style={[taskStyles.priority, { color: priorityCfg.color }]}>{priorityCfg.label}</Text>
            )}
            {shopItems.length > 0 && (
              <View style={[taskStyles.shopBadge, { backgroundColor: shopRemaining > 0 ? roomColor + '20' : colors.successLight }]}>
                <Text style={[taskStyles.shopBadgeText, { color: shopRemaining > 0 ? roomColor : colors.success }]}>
                  🛒 {shopRemaining > 0 ? shopRemaining : '✓'}
                </Text>
              </View>
            )}
          </View>
          {task.note && !expanded && (
            <Text style={taskStyles.note} numberOfLines={1}>{task.note}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={taskStyles.deleteBtn} onPress={() => onDelete(task.id)}>
          <Text style={taskStyles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={taskStyles.expandedSection}>
          {editing ? (
            <TaskForm
              roomColor={roomColor}
              initialTitle={task.title}
              initialPriority={task.priority}
              initialNote={task.note || ''}
              submitLabel="Sauvegarder"
              onSave={handleSaveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <TouchableOpacity style={taskStyles.editBtn} onPress={() => setEditing(true)}>
                <Text style={taskStyles.editBtnText}>✎ Modifier</Text>
              </TouchableOpacity>
              {task.note ? <Text style={taskStyles.noteExpanded}>{task.note}</Text> : null}
              <ShoppingSection task={task} roomColor={roomColor} onUpdate={onShoppingUpdate} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Modal principale ─────────────────────────────────────────

interface RoomDetailModalProps {
  visible: boolean;
  room: Room;
  onClose: () => void;
}

export function RoomDetailModal({ visible, room, onClose }: RoomDetailModalProps) {
  const [tasks, setTasks] = useState<RoomTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RoomTaskStatus | 'all'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const loadTasks = useCallback(() => {
    setTasks(getRoomTasks(room.id));
  }, [room.id]);

  useEffect(() => {
    if (visible) {
      loadTasks();
      setShowForm(false);
      setActiveFilter('all');
      setExpandedTaskId(null);
    }
  }, [visible, loadTasks]);

  function handleStatusChange(id: number, status: RoomTaskStatus) {
    updateRoomTaskStatus(id, status);
    loadTasks();
  }

  function handleDelete(id: number) {
    Alert.alert('Supprimer cette tâche ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: () => {
          deleteRoomTask(id);
          if (expandedTaskId === id) setExpandedTaskId(null);
          loadTasks();
        }
      },
    ]);
  }

  function handleAddTask(title: string, priority: RoomTaskPriority, note: string) {
    addRoomTask({
      room_id: room.id,
      title,
      type: 'Travaux',
      status: 'todo',
      priority,
      note,
      shopping_items: '[]',
      created_at: new Date().toISOString(),
    });
    setShowForm(false);
    loadTasks();
  }

  function handleDeleteRoom() {
    Alert.alert(`Supprimer "${room.name}" ?`, 'Toutes les tâches de la pièce seront supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { deleteRoom(room.id); onClose(); } },
    ]);
  }

  const filtered = activeFilter === 'all' ? tasks : tasks.filter((t) => t.status === activeFilter);
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const preparingCount = tasks.filter((t) => t.status === 'preparing').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const totalShopItems = tasks.reduce((acc, t) => {
    const items: RoomShoppingItem[] = JSON.parse(t.shopping_items || '[]');
    return acc + items.filter((i) => !i.done).length;
  }, 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.root}>
        {/* Header */}
        <View style={[modalStyles.header, { backgroundColor: room.color }]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.backBtn}>
            <Text style={modalStyles.backText}>‹ Retour</Text>
          </TouchableOpacity>
          <View style={modalStyles.headerCenter}>
            <Text style={modalStyles.headerIcon}>{room.icon}</Text>
            <Text style={modalStyles.headerTitle} numberOfLines={1}>{room.name}</Text>
            <Text style={modalStyles.headerSub}>
              {tasks.length === 0
                ? 'Aucune tâche'
                : `${doneCount}/${tasks.length} terminées${totalShopItems > 0 ? ` · 🛒 ${totalShopItems}` : ''}`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDeleteRoom} style={modalStyles.deleteRoomBtn}>
            <Text style={modalStyles.deleteRoomIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* Filtres */}
        <View style={modalStyles.filters}>
          {([
            ['all',         `Tout (${tasks.length})`],
            ['todo',        `À faire (${todoCount})`],
            ['preparing',   `En prép. (${preparingCount})`],
            ['in_progress', `En cours (${inProgressCount})`],
            ['done',        `Terminé (${doneCount})`],
          ] as [string, string][])
            .filter(([val]) => {
              if (val === 'all') return true;
              if (val === 'todo') return todoCount > 0;
              if (val === 'preparing') return preparingCount > 0;
              if (val === 'in_progress') return inProgressCount > 0;
              if (val === 'done') return doneCount > 0;
              return true;
            })
            .map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[
                  modalStyles.filterBtn,
                  activeFilter === val && { backgroundColor: val === 'done' ? colors.success : room.color },
                ]}
                onPress={() => setActiveFilter(val as any)}
              >
                <Text style={[modalStyles.filterText, activeFilter === val && modalStyles.filterTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Liste */}
        <ScrollView style={modalStyles.body} contentContainerStyle={modalStyles.list} showsVerticalScrollIndicator={false}>
          {showForm && (
            <TaskForm
              roomColor={room.color}
              submitLabel="Ajouter"
              onSave={handleAddTask}
              onCancel={() => setShowForm(false)}
            />
          )}

          {filtered.length === 0 && !showForm ? (
            <View style={modalStyles.empty}>
              <Text style={modalStyles.emptyEmoji}>📋</Text>
              <Text style={modalStyles.emptyText}>Aucune tâche ici</Text>
            </View>
          ) : (
            filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                roomColor={room.color}
                expanded={expandedTaskId === task.id}
                onToggleExpand={() => setExpandedTaskId((prev) => prev === task.id ? null : task.id)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onShoppingUpdate={loadTasks}
                onEdited={loadTasks}
              />
            ))
          )}
        </ScrollView>

        {/* Footer */}
        {!showForm && (
          <View style={modalStyles.footer}>
            <TouchableOpacity
              style={[modalStyles.addBtn, { backgroundColor: room.color }]}
              onPress={() => setShowForm(true)}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.addBtnText}>+ Ajouter une tâche</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxxl,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: { paddingTop: spacing.xs, width: 60 },
  backText: {
    color: colors.surface,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    opacity: 0.9,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: spacing.xs },
  headerIcon: { fontSize: 32 },
  deleteRoomBtn: { width: 60, alignItems: 'flex-end', paddingTop: spacing.xs },
  deleteRoomIcon: { fontSize: 20 },
  headerTitle: {
    fontSize: 24,
    fontFamily: fonts.display,
    color: colors.surface,
    lineHeight: 30,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  filterTextActive: { color: colors.surface, fontWeight: typography.fontWeights.bold },
  body: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxxl },
  empty: { alignItems: 'center', paddingTop: spacing.xxxxl, gap: spacing.md },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: typography.fontSizes.md, color: colors.textSecondary },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  addBtn: {
    borderRadius: radii.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
});

const taskStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, ...shadows.sm, overflow: 'hidden' },
  cardDone: { opacity: 0.65 },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.md, gap: spacing.md },
  statusBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  statusIcon: { fontSize: 16, color: colors.textSecondary, fontWeight: typography.fontWeights.bold },
  body: { flex: 1, gap: spacing.xs },
  taskTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  taskTitleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priority: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semiBold },
  shopBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full,
  },
  shopBadgeText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold },
  note: { fontSize: typography.fontSizes.sm, color: colors.textSecondary, lineHeight: 18 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  deleteIcon: { fontSize: 12, color: '#DC2626', fontWeight: typography.fontWeights.bold },
  expandedSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, gap: spacing.md, backgroundColor: colors.background + 'CC',
  },
  editBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editBtnText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  noteExpanded: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

const shopStyles = StyleSheet.create({
  root: { gap: spacing.sm },
  title: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.bold, color: colors.textPrimary },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { fontSize: 12, color: colors.surface, fontWeight: typography.fontWeights.bold },
  itemName: { flex: 1, fontSize: typography.fontSizes.sm, color: colors.textPrimary },
  itemNameDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  removeBtn: { padding: spacing.xs },
  removeIcon: { fontSize: 12, color: colors.textSecondary },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  addInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.sm, borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary,
  },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.35 },
  addBtnText: { fontSize: 20, color: colors.surface, fontWeight: typography.fontWeights.bold, lineHeight: 22 },
});

const formStyles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
    marginBottom: spacing.sm,
  },
  titleInput: {
    backgroundColor: colors.background, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.fontSizes.md, borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, minHeight: 60, textAlignVertical: 'top',
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  priorityLabel: { fontSize: typography.fontSizes.sm, color: colors.textSecondary },
  noteInput: {
    backgroundColor: colors.background, borderRadius: radii.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.fontSizes.sm, borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, minHeight: 70, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radii.full,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  saveBtn: { flex: 2, paddingVertical: spacing.md, borderRadius: radii.full, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
});
