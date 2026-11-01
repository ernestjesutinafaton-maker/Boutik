import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { HelperText } from 'react-native-paper';

import { TextField } from '@/components/text-field';
import type { FieldErrors } from '@/lib/validation';
import { useAppTheme } from '@/theme/paper-theme';

import { RoleChecklist } from './role-checklist';
import type { MemberInput } from './schemas';

type MemberFieldsProps = {
  values: MemberInput;
  onChange: (values: MemberInput) => void;
  errors: FieldErrors<MemberInput>;
};

/** Les champs d'une personne de l'équipe : nom, rôles (plusieurs possibles), remise maximale. */
export function MemberFields({ values, onChange, errors }: MemberFieldsProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.app.spacing.md }}>
      <TextField
        label={t('team.name')}
        value={values.name}
        onChangeText={(name) => onChange({ ...values, name })}
        autoCapitalize="words"
        errorMessage={errors.name ? t(errors.name) : null}
      />

      <RoleChecklist
        roles={values.roles}
        onChange={(roles) => onChange({ ...values, roles })}
        error={errors.roles ?? null}
      />

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
