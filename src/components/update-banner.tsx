import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useWebUpdate } from '@/pwa/web-app';
import { useAppTheme } from '@/theme/paper-theme';

/** Bandeau « Nouvelle version de Boutik disponible » : un bouton pour l'installer. */
export function UpdateBanner() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const web = useWebUpdate();

  if (!web.available) {
    return null;
  }
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.app.colors.accentContainer,
          borderRadius: theme.app.radius.md,
          padding: theme.app.spacing.sm,
          gap: theme.app.spacing.sm,
        },
      ]}>
      <Icon source="update" size={22} color={theme.app.colors.onAccentContainer} />
      <Text
        variant="bodyLarge"
        style={[styles.text, { color: theme.app.colors.onAccentContainer }]}>
        {t('updates.available')}
      </Text>
      <Button mode="contained" onPress={web.apply}>
        {t('updates.install')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  text: {
    flex: 1,
    minWidth: 160,
  },
});
