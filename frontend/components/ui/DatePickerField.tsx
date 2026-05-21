import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform,
  Pressable, Keyboard, Animated, Easing, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const ITEM_H = 48;
const VISIBLE = 5;
const CENTER = Math.floor(VISIBLE / 2);
const SHEET_TRANSLATE = 380;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => THIS_YEAR + i);

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDate(s: string) { return new Date(`${s}T00:00:00`); }

function formatDisplay(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function buildDateStr(monthIdx: number, dayIdx: number, year: number) {
  return `${year}-${pad(monthIdx + 1)}-${pad(dayIdx + 1)}`;
}

// ── WheelColumn ───────────────────────────────────────────────────────────────
interface WheelProps {
  items: string[];
  selectedIndex: number;
  onChange: (i: number) => void;
  flex?: number;
}

function WheelColumn({ items, selectedIndex, onChange, flex = 1 }: WheelProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex, items]);

  const snap = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(Math.round(raw / ITEM_H), items.length - 1));
    ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    onChange(idx);
  };

  return (
    <View style={[wheel.wrapper, { flex }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[wheel.line, { top: CENTER * ITEM_H }]} />
        <View style={[wheel.line, { top: (CENTER + 1) * ITEM_H }]} />
      </View>

      <ScrollView
        ref={ref}
        style={wheel.scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: CENTER * ITEM_H }}
        onMomentumScrollEnd={snap}
        onScrollEndDrag={snap}
      >
        {items.map((item, i) => (
          <View key={i} style={wheel.item}>
            <Text style={[wheel.text, i === selectedIndex && wheel.textSelected]}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const wheel = StyleSheet.create({
  wrapper: {
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  item: {
    height: ITEM_H,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  textSelected: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
});

// ── DatePickerField ───────────────────────────────────────────────────────────
interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (s: string) => void;
  error?: string;
  minimumDate?: Date;
}

export function DatePickerField({ label, value, onChange, error, minimumDate }: DatePickerFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(SHEET_TRANSLATE)).current;

  const initDate = value ? toLocalDate(value) : (minimumDate ?? new Date());
  const [monthIdx, setMonthIdx] = useState(initDate.getMonth());
  const [yearIdx, setYearIdx]   = useState(Math.max(0, YEARS.indexOf(initDate.getFullYear())));
  const [dayIdx, setDayIdx]     = useState(initDate.getDate() - 1);

  const selectedYear = YEARS[yearIdx];
  const numDays = daysInMonth(monthIdx, selectedYear);
  const dayItems = Array.from({ length: numDays }, (_, i) => String(i + 1));
  const clampedDay = Math.min(dayIdx, numDays - 1);

  const handleMonthChange = (i: number) => {
    setMonthIdx(i);
    setDayIdx((prev) => Math.min(prev, daysInMonth(i, selectedYear) - 1));
  };

  const handleYearChange = (i: number) => {
    setYearIdx(i);
    setDayIdx((prev) => Math.min(prev, daysInMonth(monthIdx, YEARS[i]) - 1));
  };

  const openSheet = () => {
    Keyboard.dismiss();
    const d = value ? toLocalDate(value) : (minimumDate ?? new Date());
    setMonthIdx(d.getMonth());
    setYearIdx(Math.max(0, YEARS.indexOf(d.getFullYear())));
    setDayIdx(d.getDate() - 1);
    backdropAnim.setValue(0);
    sheetAnim.setValue(SHEET_TRANSLATE);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetAnim,   { toValue: 0, duration: 300, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = (confirm: boolean) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(sheetAnim,   { toValue: SHEET_TRANSLATE, duration: 240, easing: Easing.in(Easing.poly(4)), useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      if (confirm) {
        let dateStr = buildDateStr(monthIdx, clampedDay, selectedYear);
        if (minimumDate) {
          const minStr = `${minimumDate.getFullYear()}-${pad(minimumDate.getMonth() + 1)}-${pad(minimumDate.getDate())}`;
          if (dateStr < minStr) dateStr = minStr;
        }
        onChange(dateStr);
      }
    });
  };

  // Android: native dialog
  const [androidOpen, setAndroidOpen] = useState(false);
  const currentDate = value ? toLocalDate(value) : (minimumDate ?? new Date());

  const handleAndroidChange = (_e: DateTimePickerEvent, date?: Date) => {
    setAndroidOpen(false);
    if (_e.type === 'set' && date) {
      onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
    }
  };

  const handlePress = () => {
    Keyboard.dismiss();
    if (Platform.OS === 'android') { setAndroidOpen(true); return; }
    openSheet();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.field, modalVisible && styles.fieldActive, error ? styles.fieldError : null]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDisplay(value) : 'Select date'}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={modalVisible ? theme.colors.primary : theme.colors.textMuted}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'android' && androidOpen && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent>
          <View style={styles.modalOuter}>
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet(false)} />
            </Animated.View>

            <Animated.View style={{ transform: [{ translateY: sheetAnim }] }}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={styles.sheetHeader}>
                  <TouchableOpacity onPress={() => closeSheet(false)} hitSlop={8}>
                    <Text style={styles.cancelBtn}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>{label}</Text>
                  <TouchableOpacity onPress={() => closeSheet(true)} hitSlop={8}>
                    <Text style={styles.doneBtn}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.wheelsRow}>
                  <WheelColumn items={MONTHS}            selectedIndex={monthIdx}   onChange={handleMonthChange} flex={3} />
                  <WheelColumn items={dayItems}           selectedIndex={clampedDay} onChange={setDayIdx}         flex={2} />
                  <WheelColumn items={YEARS.map(String)} selectedIndex={yearIdx}    onChange={handleYearChange}  flex={3} />
                </View>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.text },
  field: {
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldActive:  { borderColor: theme.colors.primary },
  fieldError:   { borderColor: theme.colors.error, backgroundColor: theme.colors.errorLight },
  fieldText:    { fontSize: 15, color: theme.colors.text },
  placeholder:  { color: theme.colors.textMuted },
  error:        { fontSize: 12, color: theme.colors.error, fontWeight: '500' },
  modalOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sheetTitle:  { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  cancelBtn:   { fontSize: 15, color: theme.colors.textMuted },
  doneBtn:     { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  wheelsRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
  },
});
