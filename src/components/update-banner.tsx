import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useWebUpdate } from '@/pwa/web-app';
import { useAppUpdate, useNewApk } from '@/updates/app-updates';
import { useAppTheme } from '@/theme/paper-theme';

/** Bandeau « Nouvelle version de Boutik disponible » : un bouton pour l'installer. */
export function UpdateBanner() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const web = useWebUpdate();
  const app = useAppUpdate();
  const apk = useNewApk();

  // Priorité : nouveau code prêt (web ou appli), sinon nouvelle version de l'APK à installer
  const ready = web.available || app.ready;
  if (!ready && !apk) {
    return null;
  }
  const message = ready
    ? t('updates.available')
    : t('updates.apkAvailable', { version: apk?.version ?? '' });
  const action = ready
    ? { label: t('updates.install'), run: web.available ? web.apply : app.apply }
    : { label: t('updates.download'), run: () => apk && Linking.openURL(apk.url) };
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
        {message}
      </Text>
      <Button mode="contained" onPress={action.run}>
        {action.label}
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
