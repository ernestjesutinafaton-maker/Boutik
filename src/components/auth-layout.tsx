import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

import { Card } from './card';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Mise en page des écrans d'accueil (connexion, inscription, création de la boutique) :
 * fond « nuit violette », la boutique Boutik en 3D (dessin d'Ernest), puis une carte avec
 * le formulaire, centrée sur grand écran.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, effects, radius, spacing } = theme.app;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      // Remonte le formulaire quand le clavier apparaît (téléphone)
      behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      {/* Heure et batterie en blanc, sur le fond sombre */}
      <StatusBar style="light" />
      <ScrollView
        style={[
          styles.fill,
          { backgroundColor: colors.night, backgroundImage: effects.authGradient },
        ]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            padding: spacing.md,
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}>
        <View style={[styles.inner, { gap: spacing.lg }]}>
          <View style={[styles.brand, { gap: spacing.sm }]}>
            <Image
              source={require('@/assets/images/boutique-3d.webp')}
              style={styles.illustration}
              contentFit="contain"
              accessibilityLabel={t('app.name')}
            />
            <Text variant="bodyLarge" style={[styles.center, { color: colors.onNightSecondary }]}>
              {t('app.tagline')}
            </Text>
          </View>

          <Card mode="outlined" style={{ borderRadius: radius.xl, borderColor: 'transparent' }}>
            <Card.Content style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text variant="headlineSmall">{title}</Text>
              {subtitle ? (
                <Text variant="bodyLarge" style={{ color: colors.textSecondary }}>
                  {subtitle}
                </Text>
              ) : null}
              {children}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 480,
  },
  brand: {
    alignItems: 'center',
  },
  illustration: {
    width: 190,
    height: 190,
  },
  center: {
    textAlign: 'center',
  },
});
