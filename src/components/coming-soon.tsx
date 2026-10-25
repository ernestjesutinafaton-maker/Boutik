import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';

import type { IconName } from '@/components/icon-name';
import { useAppTheme } from '@/theme/paper-theme';

type ComingSoonProps = {
  icon: IconName;
  /** Ce que contiendra l'écran */
  description: string;
  /** Numéro de l'étape du plan (docs/PLAN.md) où cet écran sera construit */
  step: number;
};

/** Carte provisoire « Bientôt disponible », pour les écrans pas encore construits. */
export function ComingSoon({ icon, description, step }: ComingSoonProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card mode="outlined">
      <Card.Content style={[styles.content, { gap: theme.app.spacing.sm }]}>
        <Icon source={icon} size={56} color={theme.colors.primary} />
        <Text variant="titleLarge" style={styles.bold}>
          {t('comingSoon.title')}
        </Text>
        <Text variant="bodyLarge" style={styles.centered}>
          {description}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('comingSoon.plannedStep', { step })}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  centered: {
    textAlign: 'center',
  },
});
