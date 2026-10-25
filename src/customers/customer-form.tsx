import { useTranslation } from 'react-i18next';
import { HelperText } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useActiveMember } from '@/team/active-member-provider';

import type { CustomerErrors, CustomerInput } from './customer-form-values';

type CustomerFormProps = {
  values: CustomerInput;
  onChange: (values: CustomerInput) => void;
  errors: CustomerErrors;
  formError: string | null;
  isSaving: boolean;
  onSave: () => void;
};

/** Les champs d'un client : nom, téléphone, plafond de crédit, remarques. */
export function CustomerForm({
  values,
  onChange,
  errors,
  formError,
  isSaving,
  onSave,
}: CustomerFormProps) {
  const { t } = useTranslation();
  const { can } = useActiveMember();

  return (
    <>
      <TextField
        label={t('customers.name')}
        value={values.name}
        onChangeText={(name) => onChange({ ...values, name })}
        autoCapitalize="words"
        errorMessage={errors.name ? t(errors.name) : null}
      />
      <TextField
        label={t('customers.phone')}
        placeholder="01 97 00 00 00"
        value={values.phone}
        onChangeText={(phone) => onChange({ ...values, phone })}
        keyboardType="phone-pad"
        errorMessage={errors.phone ? t(errors.phone) : null}
      />
      <TextField
        label={t('customers.creditLimit')}
        value={values.creditLimit}
        onChangeText={(creditLimit) => onChange({ ...values, creditLimit })}
        keyboardType="numeric"
        // Le plafond de crédit est une décision du propriétaire ou du gérant
        disabled={!can('prices.edit')}
        errorMessage={errors.creditLimit ? t(errors.creditLimit) : null}
      />
      <HelperText type="info" visible>
        {t('customers.creditLimitHelp')}
      </HelperText>
      <TextField
        label={t('customers.notes')}
        value={values.notes}
        onChangeText={(notes) => onChange({ ...values, notes })}
        multiline
      />
      {formError ? <Notice message={formError} /> : null}
      <BigButton icon="content-save" onPress={onSave} loading={isSaving} disabled={isSaving}>
        {t('common.save')}
      </BigButton>
    </>
  );
}
