import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { MoneyText } from '@/components/money-text';
import { isCourierOnly } from '@/domain/permissions';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { useCourierBalances, useDeliveries } from './delivery-data';

/** Tableau de bord du livreur : ses livraisons du moment, celles à prendre, son argent. */
export function CourierCard() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const { member } = useActiveMember();
  const { deliveries } = useDeliveries();
  const balances = useCourierBalances();
  const memberId = member?.id ?? '';
  const mine = deliveries.filter((delivery) => delivery.assignedTo === memberId);
  const todo = mine.filter(
    (delivery) => delivery.status === 'pending' || delivery.status === 'failed'
  ).length;
  const active = mine.filter((delivery) => delivery.status === 'in_progress').length;
  const open = deliveries.filter(
    (delivery) => delivery.assignedTo === null && delivery.status === 'pending'
  ).length;
  const held = balances.find((line) => line.courierId === memberId)?.amount ?? 0;
  // Le livreur seul a son onglet ; un vendeur-livreur ouvre l'écran des livraisons
  const listHref = isCourierOnly(member?.roles ?? []) ? '/deliveries' : '/delivery';

  return (
    <Card mode="outlined">
      <Card.Title title={t('deliveries.dashboard.title')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        <Line label={t('deliveries.dashboard.active')} value={active} />
        <Line label={t('deliveries.dashboard.todo')} value={todo} />
        <Line label={t('deliveries.dashboard.open')} value={open} />
        <View style={{ gap: 2 }}>
          <Text variant="bodyLarge">{t('deliveries.dashboard.held')}</Text>
          <MoneyText
            amount={held}
            currency={shop?.currencyCode ?? 'XOF'}
            tone={held > 0 ? 'primary' : 'default'}
          />
        </View>
        <BigButton icon="moped" onPress={() => router.push(listHref)}>
          {t('deliveries.dashboard.see')}
        </BigButton>
        <BigButton
          icon="receipt"
          variant="outline"
          onPress={() => router.push('/delivery/expense')}>
          {t('deliveries.dashboard.addExpense')}
        </BigButton>
      </Card.Content>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.between}>
      <Text variant="bodyLarge">{label}</Text>
      <Text variant="titleLarge" style={styles.bold}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bold: {
    fontWeight: '700',
  },
});
