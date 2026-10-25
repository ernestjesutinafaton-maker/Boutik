import { Button, type ButtonProps } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

type BigButtonVariant = 'primary' | 'accent' | 'danger' | 'outline';

type BigButtonProps = Omit<ButtonProps, 'mode' | 'buttonColor' | 'textColor'> & {
  /**
   * primary = vert (action normale), accent = orange (action importante),
   * danger = rouge (action risquée), outline = discret (action secondaire)
   */
  variant?: BigButtonVariant;
};

/** Gros bouton facile à toucher, utilisé dans toute l'application. */
export function BigButton({
  variant = 'primary',
  contentStyle,
  labelStyle,
  ...rest
}: BigButtonProps) {
  const theme = useAppTheme();
  const { colors, touch, fontSize } = theme.app;

  const colorsByVariant = {
    primary: { buttonColor: colors.primary, textColor: colors.onPrimary },
    accent: { buttonColor: colors.accent, textColor: colors.onAccent },
    danger: { buttonColor: colors.danger, textColor: colors.onDanger },
    outline: { buttonColor: undefined, textColor: colors.primary },
  }[variant];

  return (
    <Button
      mode={variant === 'outline' ? 'outlined' : 'contained'}
      buttonColor={colorsByVariant.buttonColor}
      textColor={colorsByVariant.textColor}
      contentStyle={[{ minHeight: touch.minHeight }, contentStyle]}
      labelStyle={[{ fontSize: fontSize.large, lineHeight: 24, fontWeight: '700' }, labelStyle]}
      {...rest}
    />
  );
}
