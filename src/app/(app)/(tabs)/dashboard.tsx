import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, List } from 'react-native-paper';

import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';
import { useActiveMember } from '@/team/active-member-provider';

/**
 * Rubrique « Tableau de bord ».
 * Pour l'instant : les accès à la caisse du jour et aux rapports (étape 15).
 * Les chiffres et graphiques arrivent à l'étape 16.
 */
export default function DashboardScreen() {
  const { t } = useTranslation();
  const { can } = useActiveMember();

  return (
    <Screen title={t('nav.dashboard')}>
      {can('reports.account') || can('cash.session') ? (
        <Card mode="outlined">
          {can('cash.session') ? (
            <List.Item
              title={t('cash.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('more.cashHelp')}
              left={(props) => <List.Icon {...props} icon="cash-register" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/cash')}
            />
          ) : null}
          <List.Item
            title={t('report.archivesTitle')}
            titleStyle={{ fontWeight: '700' }}
            description={t('more.reportsHelp')}
            left={(props) => <List.Icon {...props} icon="archive-clock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/report')}
          />
        </Card>
      ) : null}
      <ComingSoon icon="view-dashboard" description={t('dashboard.description')} step={16} />
    </Screen>
  );
}
