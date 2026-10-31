import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { ANDROID_APK_URL } from '@/config/downloads';
import { useInstallPrompt } from '@/pwa/web-app';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Page publique « Télécharger Boutik » (sans connexion) : l'APK Android,
 * l'installation sur iPhone (écran d'accueil) et sur ordinateur.
 */
export default function DownloadScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { canInstall, install } = useInstallPrompt();
  const { spacing } = theme.app;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { padding: spacing.md, paddingTop: insets.top + spacing.xl, gap: spacing.md },
      ]}>
      <View style={[styles.inner, { gap: spacing.md }]}>
        <Text
          variant="displaySmall"
          style={[styles.center, styles.bold, { color: theme.colors.primary }]}>
          Boutik
        </Text>
        <Text variant="titleMedium" style={styles.center}>
          {t('download.tagline')}
        </Text>

        <Card mode="outlined">
          <Card.Title title={t('download.androidTitle')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.sm }}>
            <BigButton icon="android" onPress={() => Linking.openURL(ANDROID_APK_URL)}>
              {t('download.androidButton')}
            </BigButton>
            <Text variant="bodyLarge">{t('download.androidSteps')}</Text>
          </Card.Content>
        </Card>

        <Card mode="outlined">
          <Card.Title title={t('download.iphoneTitle')} titleVariant="titleLarge" />
          <Card.Content>
            <Text variant="bodyLarge">{t('download.iphoneSteps')}</Text>
          </Card.Content>
        </Card>

        <Card mode="outlined">
          <Card.Title title={t('download.computerTitle')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.sm }}>
            {canInstall ? (
              <BigButton icon="monitor-arrow-down" variant="accent" onPress={install}>
                {t('download.installButton')}
              </BigButton>
            ) : null}
            <Text variant="bodyLarge">{t('download.computerSteps')}</Text>
          </Card.Content>
        </Card>

        <BigButton icon="open-in-app" variant="outline" onPress={() => router.replace('/')}>
          {t('download.openWeb')}
        </BigButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 640,
  },
  center: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '800',
  },
});
