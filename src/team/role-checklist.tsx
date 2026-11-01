import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Checkbox, HelperText, List, Text } from 'react-native-paper';

import { ROLES, type Role } from '@/domain/permissions';
import type { TranslationKey } from '@/i18n/keys';

/** Les rôles qu'on peut donner (le rôle « propriétaire » reste celui du compte). */
const ASSIGNABLE_ROLES = ROLES.filter((role) => role !== 'owner');

type RoleChecklistProps = {
  roles: readonly Role[];
  onChange: (roles: Role[]) => void;
  /** Message d'erreur (clé de traduction), ou rien */
  error?: TranslationKey | null;
};

/** Les rôles d'une personne de l'équipe, à cocher (plusieurs possibles), avec ce que fait chacun. */
export function RoleChecklist({ roles, onChange, error }: RoleChecklistProps) {
  const { t } = useTranslation();

  function toggle(role: Role) {
    onChange(roles.includes(role) ? roles.filter((current) => current !== role) : [...roles, role]);
  }

  return (
    <View>
      <Text variant="titleMedium">{t('team.rolesLabel')}</Text>
      {ASSIGNABLE_ROLES.map((role) => (
        <List.Item
          key={role}
          title={t(`roles.${role}`)}
          description={t(`roleHelp.${role}`)}
          descriptionNumberOfLines={3}
          onPress={() => toggle(role)}
          left={() => (
            <Checkbox.Android
              status={roles.includes(role) ? 'checked' : 'unchecked'}
              onPress={() => toggle(role)}
            />
          )}
        />
      ))}
      {error ? (
        <HelperText type="error" visible>
          {t(error)}
        </HelperText>
      ) : null}
    </View>
  );
}
