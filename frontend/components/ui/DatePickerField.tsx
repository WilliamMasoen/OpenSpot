import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform,
  Pressable, Keyboard, Animated, Easing,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

const SHEET_TRANSLATE = 560;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocalDate(s: string) { return new Date(`${s}T00:00:00`); }
function dateToStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatDisplay(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (s: string) => void;
  error?: string;
  minimumDate?: Date;
}

export function DatePickerField({ label, value, onChange, error, minimumDate }: DatePickerFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [draft, setDraft] = useState<Date>(() => value ? toLocalDate(value) : (minimumDate ?? new Date()));
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(SHEET_TRANSLATE)).current;

  // Android: native dialog
  const [androidOpen, setAndroidOpen] = useState(false);

  const openSheet = () => {
    Keyboard.dismiss();
    setDraft(value ? toLocalDate(value) : (minimumDate ?? new Date()));
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
        let dateStr = dateToStr(draft);
        if (minimumDate) {
          const minStr = dateToStr(minimumDate);
          if (dateStr < minStr) dateStr = minStr;
        }
        onChange(dateStr);
      }
    });
  };

  const handleChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (date) setDraft(date);
  };

  const handleAndroidChange = (_e: DateTimePickerEvent, date?: Date) => {
    setAndroidOpen(false);
    if (_e.type === 'set' && date) onChange(dateToStr(date));
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
          value={value ? toLocalDate(value) : (minimumDate ?? new Date())}
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

                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="inline"
                  onChange={handleChange}
                  minimumDate={minimumDate}
                  accentColor={theme.colors.primary}
                  style={styles.calendar}
                />
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
  calendar: {
    alignSelf: 'center',
  },
});
