import { useTranslation } from 'react-i18next';

import { StatusChip } from '@/components/status-chip';
import type { DebtAging } from '@/domain/credit';

/** Étiquette d'ancienneté de la dette : récente, plus de 30 jours, plus de 60 jours. */
export function AgingChip({ aging }: { aging: DebtAging }) {
  const { t } = useTranslation();
  switch (aging.bucket) {
    case 'none':
      return null;
    case 'recent':
      return (
        <StatusChip
          tone="neutral"
          icon="clock-outline"
          label={t('customers.aging.recent', { count: aging.ageDays })}
        />
      );
    case 'over30':
      return <StatusChip tone="warning" icon="clock-alert" label={t('customers.aging.over30')} />;
    case 'over60':
      return <StatusChip tone="danger" icon="alert-octagon" label={t('customers.aging.over60')} />;
  }
}
