import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Checkbox, HelperText, List, Text } from 'react-native-paper';

import { TextField } from '@/components/text-field';
import { ROLES, type Role } from '@/domain/permissions';
import type { FieldErrors } from '@/lib/validation';
import { useAppTheme } from '@/theme/paper-theme';

import type { MemberInput } from './schemas';

/** Les rôles qu'on peut donner (le rôle « propriétaire » reste celui du compte). */
const ASSIGNABLE_ROLES = ROLES.filter((role) => role !== 'owner');

type MemberFieldsProps = {
  values: MemberInput;
  onChange: (values: MemberInput) => void;
  errors: FieldErrors<MemberInput>;
};

/** Les champs d'une personne de l'équipe : nom, rôles (plusieurs possibles), remise maximale. */
export function MemberFields({ values, onChange, errors }: MemberFieldsProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  function toggleRole(role: Role) {
    const roles = values.roles.includes(role)
      ? values.roles.filter((current) => current !== role)
      : [...values.roles, role];
    onChange({ ...values, roles });
  }

  return (
    <View style={{ gap: theme.app.spacing.md }}>
      <TextField
        label={t('team.name')}
        value={values.name}
        onChangeText={(name) => onChange({ ...values, name })}
        autoCapitalize="words"
        errorMessage={errors.name ? t(errors.name) : null}
      />

      <View>
        <Text variant="titleMedium">{t('team.rolesLabel')}</Text>
        {ASSIGNABLE_ROLES.map((role) => (
          <List.Item
            key={role}
            title={t(`roles.${role}`)}
            description={t(`roleHelp.${role}`)}
            descriptionNumberOfLines={3}
            onPress={() => toggleRole(role)}
            left={() => (
              <Checkbox.Android
                status={values.roles.includes(role) ? 'checked' : 'unchecked'}
                onPress={() => toggleRole(role)}
              />
            )}
          />
        ))}
        {errors.roles ? (
          <HelperText type="error" visible>
            {t(errors.roles)}
          </HelperText>
        ) : null}
      </View>

      <View>
        <TextField
          label={t('team.maxDiscount')}
          value={values.maxDiscountPercent}
          onChangeText={(maxDiscountPercent) => onChange({ ...values, maxDiscountPercent })}
          keyboardType="number-pad"
          errorMessage={errors.maxDiscountPercent ? t(errors.maxDiscountPercent) : null}
        />
        <HelperText type="info" visible>
          {t('team.maxDiscountHelp')}
        </HelperText>
      </View>
    </View>
  );
}
