import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

type PinPadProps = {
  /** Appelé dès que les 4 chiffres sont tapés */
  onComplete: (pin: string) => void;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'erase'] as const;
const PIN_LENGTH = 4;

/** Clavier du code PIN : 4 points qui se remplissent, et de gros chiffres faciles à toucher. */
export function PinPad({ onComplete, disabled = false }: PinPadProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [digits, setDigits] = useState('');
  const { colors, spacing, radius, fontSize } = theme.app;

  function press(key: (typeof KEYS)[number]) {
    if (disabled || key === '') {
      return;
    }
    if (key === 'erase') {
      setDigits((current) => current.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, PIN_LENGTH);
    if (next.length === PIN_LENGTH) {
      setDigits('');
      onComplete(next);
    } else {
      setDigits(next);
    }
  }

  return (
    <View style={[styles.container, { gap: spacing.lg }]}>
      <View style={[styles.dots, { gap: spacing.md }]} accessibilityLabel={`${digits.length}/4`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: colors.primary,
                backgroundColor: index < digits.length ? colors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.grid, { gap: spacing.sm }]}>
        {KEYS.map((key, index) => (
          <TouchableRipple
            key={`${key}-${index}`}
            onPress={() => press(key)}
            disabled={disabled || key === ''}
            accessibilityRole="button"
            accessibilityLabel={key === 'erase' ? t('lock.erase') : key}
            borderless
            style={[
              styles.key,
              {
                borderRadius: radius.lg,
                backgroundColor: key === '' ? 'transparent' : colors.surfaceVariant,
                opacity: disabled ? 0.5 : 1,
              },
            ]}>
            {key === 'erase' ? (
              <Icon source="backspace-outline" size={28} color={colors.text} />
            ) : (
              <Text style={[styles.keyText, { color: colors.text, fontSize: fontSize.amount }]}>
                {key}
              </Text>
            )}
          </TouchableRipple>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 3 * 80 + 2 * 8,
  },
  key: {
    width: 80,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontWeight: '700',
  },
});
