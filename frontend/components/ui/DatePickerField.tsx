import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { theme } from '@/constants/theme';

function toLocalDate(dateStr: string): Date {
  // Append local time to avoid UTC midnight shifting the day back
  return new Date(`${dateStr}T00:00:00`);
}

function dateToString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}

interface DatePickerFieldProps {
  label: string;
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (dateStr: string) => void;
  error?: string;
  minimumDate?: Date;
}

export function DatePickerField({ label, value, onChange, error, minimumDate }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  // tempDate tracks the picker's in-progress selection on iOS before the user taps Done
  const [tempDate, setTempDate] = useState<Date>(value ? toLocalDate(value) : new Date());

  const currentDate = value ? toLocalDate(value) : new Date();

  const handleOpen = () => {
    setTempDate(currentDate);
    setOpen(true);
  };

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (_event.type === 'set' && date) onChange(dateToString(date));
    } else {
      if (date) setTempDate(date);
    }
  };

  const handleDone = () => {
    onChange(dateToString(tempDate));
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.field, error ? styles.fieldError : null]}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {value ? formatDisplay(value) : 'Select date'}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Android — picker renders as a native dialog, no modal needed */}
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
        />
      )}

      {/* iOS — wrap in a bottom-sheet modal with Cancel / Done */}
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide">
          <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                  <Text style={styles.cancelBtn}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>{label}</Text>
                <TouchableOpacity onPress={handleDone} hitSlop={8}>
                  <Text style={styles.doneBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                style={styles.spinner}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
  },
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
  fieldError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  fieldText: {
    fontSize: 15,
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
  calendarIcon: {
    fontSize: 16,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: '500',
  },
  // Modal / bottom sheet
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingBottom: 24,
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
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cancelBtn: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  doneBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  spinner: {
    height: 200,
  },
});
