import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';

/** Rubrique « Clients » : construite à l'étape 14 (clients et ventes à crédit). */
export default function CustomersScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('nav.customers')}>
      <ComingSoon icon="account-group" description={t('customers.description')} step={14} />
    </Screen>
  );
}
