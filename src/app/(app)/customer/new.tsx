import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { getCountry } from '@/config/countries';
import { createCustomer } from '@/customers/customer-actions';
import { CustomerForm } from '@/customers/customer-form';
import {
  type CustomerErrors,
  type CustomerInput,
  emptyCustomerInput,
  parseCustomerInput,
} from '@/customers/customer-form-values';
import { useActionContext } from '@/data/use-action-context';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Nouveau client. */
export default function NewCustomerScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const [values, setValues] = useState<CustomerInput>(emptyCustomerInput);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!can('customers.edit')) {
    return (
      <Screen title={t('customers.newTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleSave() {
    if (!shop || !context) {
      return;
    }
    const result = parseCustomerInput(
      values,
      shop.currencyCode,
      getCountry(shop.countryCode).dialCode
    );
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const id = await createCustomer(db, context, result.data);
      router.replace(`/customer/${id}`);
    } catch (error) {
      console.warn('Création du client impossible :', error);
      setFormError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('customers.newTitle')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          <CustomerForm
            values={values}
            onChange={setValues}
            errors={errors}
            formError={formError}
            isSaving={isSaving}
            onSave={handleSave}
          />
        </Card.Content>
      </Card>
    </Screen>
  );
}
