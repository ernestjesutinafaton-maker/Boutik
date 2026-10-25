import { useTranslation } from 'react-i18next';

import { StatusChip } from '@/components/status-chip';
import type { ExpiryLevel } from '@/domain/expiry';

/** Étiquette de péremption d'un produit : « Périmé », « Périme bientôt », « À surveiller ». */
export function ExpiryChip({ level }: { level: ExpiryLevel }) {
  const { t } = useTranslation();
  if (level === 'ok') {
    return null;
  }
  if (level === 'expired') {
    return <StatusChip tone="danger" icon="calendar-remove" label={t('alerts.badgeExpired')} />;
  }
  if (level === 'urgent') {
    return <StatusChip tone="danger" icon="calendar-alert" label={t('alerts.badgeUrgent')} />;
  }
  return <StatusChip tone="warning" icon="calendar-clock" label={t('alerts.badgeSoon')} />;
}
