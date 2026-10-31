import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

type NoticeProps = {
  message: string;
  /** error = rouge (quelque chose ne va pas), info = vert (bonne nouvelle, information) */
  tone?: 'error' | 'info';
};

/** Encadré de message bien visible : erreur, ou information. */
export function Notice({ message, tone = 'error' }: NoticeProps) {
  const theme = useAppTheme();
  const { colors, effects, depth, spacing, radius } = theme.app;
  const isError = tone === 'error';
  const backgroundColor = isError ? colors.dangerContainer : colors.primaryContainer;
  const color = isError ? colors.onDangerContainer : colors.onPrimaryContainer;

  return (
    <View
      accessibilityRole={isError ? 'alert' : 'text'}
      style={[
        styles.notice,
        {
          backgroundColor,
          borderBottomWidth: depth.chip,
          borderBottomColor: effects.noticeEdge[tone],
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}>
      <Icon source={isError ? 'alert-circle' : 'information'} size={24} color={color} />
      <Text variant="bodyLarge" style={[styles.text, { color }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    flex: 1,
  },
});
