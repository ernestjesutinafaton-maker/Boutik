import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'react-native-paper';

import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { getCountry } from '@/config/countries';
import { updateCustomer } from '@/customers/customer-actions';
import { type Customer, useCustomer } from '@/customers/customer-data';
import { CustomerForm } from '@/customers/customer-form';
import {
  type CustomerErrors,
  type CustomerInput,
  customerToInput,
  parseCustomerInput,
} from '@/customers/customer-form-values';
import { useActionContext } from '@/data/use-action-context';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Modifier un client. */
export default function EditCustomerScreen() {
  const { t } = useTranslation();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { customer, isLoading } = useCustomer(customerId);
  const { can } = useActiveMember();

  if (!can('customers.edit')) {
    return (
      <Screen title={t('customers.editTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!customer) {
    return (
      <Screen title={t('customers.editTitle')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }
  return <EditForm customer={customer} />;
}

function EditForm({ customer }: { customer: Customer }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const [values, setValues] = useState<CustomerInput>(() =>
    customerToInput(customer, shop?.currencyCode ?? 'XOF')
  );
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      await updateCustomer(db, context, customer, result.data);
      router.back();
    } catch (error) {
      console.warn('Modification du client impossible :', error);
      setFormError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('customers.editTitle')} stack>
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
