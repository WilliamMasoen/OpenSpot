import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  color?: string;
}

export function StarRating({ value, onChange, size = 24, color = '#F59E0B' }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        if (onChange) {
          return (
            <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={4}>
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={size}
                color={filled ? color : '#D1D5DB'}
              />
            </TouchableOpacity>
          );
        }
        return (
          <Ionicons
            key={star}
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? color : '#D1D5DB'}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
});
