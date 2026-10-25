import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Sur un appareil partagé : qui travaille en ce moment, et un bouton pour passer la main.
 * Rien ne s'affiche s'il n'y a qu'une personne dans la boutique.
 */
export function ActiveMemberBar() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { usesPin, member, lock } = useActiveMember();

  if (!usesPin || !member) {
    return null;
  }

  return (
    <View style={[styles.bar, { gap: theme.app.spacing.sm }]}>
      <Icon source="account-circle" size={24} color={theme.app.colors.primary} />
      <Text variant="bodyLarge" numberOfLines={1} style={styles.name}>
        <Text style={styles.bold}>{member.name}</Text>
        {member.roles.length
          ? ` · ${member.roles.map((role) => t(`roles.${role}`)).join(', ')}`
          : ''}
      </Text>
      <Button compact icon="account-switch" onPress={lock}>
        {t('lock.switchUser')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
});
