import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';

/** Rubrique « Tableau de bord » : construite à l'étape 16. */
export default function DashboardScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('nav.dashboard')}>
      <ComingSoon icon="view-dashboard" description={t('dashboard.description')} step={16} />
    </Screen>
  );
}
