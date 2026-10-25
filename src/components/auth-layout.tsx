import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Mise en page des écrans d'accueil (connexion, inscription, création de la boutique) :
 * le nom Boutik en grand, puis une carte avec le formulaire, centrée sur grand écran.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = theme.app;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      // Remonte le formulaire quand le clavier apparaît (téléphone)
      behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView
        style={[styles.fill, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            padding: spacing.md,
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}>
        <View style={[styles.inner, { gap: spacing.md }]}>
          <View style={styles.brand}>
            <Text
              style={[styles.brandName, { color: colors.primary, fontSize: fontSize.amountLarge }]}>
              {t('app.name')}
            </Text>
            <Text variant="bodyLarge" style={{ color: colors.textSecondary }}>
              {t('app.tagline')}
            </Text>
          </View>

          <Card mode="outlined">
            <Card.Content style={{ gap: spacing.md }}>
              <Text variant="headlineSmall" style={styles.bold}>
                {title}
              </Text>
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
  brandName: {
    fontWeight: '800',
  },
  bold: {
    fontWeight: '700',
  },
});
