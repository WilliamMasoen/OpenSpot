export const theme = {
  colors: {
    primary: '#1A56FF',
    primaryLight: '#EBF0FF',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    success: '#10B981',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    heading: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.5 },
    subheading: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '400' as const },
    label: { fontSize: 13, fontWeight: '500' as const },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
  },
} as const;
