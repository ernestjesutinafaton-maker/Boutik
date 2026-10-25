import { usePowerSync, useQuery } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, List, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';
import { deviceName } from '@/device/device';
import { useShop } from '@/shop/shop-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Rubrique « Clients » : construite à l'étape 14 (clients et ventes à crédit). */
export default function CustomersScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('nav.customers')}>
      <SyncTestCard />
      <ComingSoon icon="account-group" description={t('customers.description')} step={14} />
    </Screen>
  );
}

/**
 * Carte PROVISOIRE pour essayer la synchronisation hors ligne (étape 6) :
 * on ajoute des clients d'essai dans la base LOCALE, et PowerSync les envoie au serveur
 * dès que possible. Elle sera remplacée par la vraie liste des clients à l'étape 14.
 */
function SyncTestCard() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const { shop, device } = useShop();
  const [isAdding, setIsAdding] = useState(false);
  const shopId = shop?.id ?? '';

  // Ces listes se mettent à jour TOUTES SEULES quand la base locale change
  const { data: countRows } = useQuery<{ count: number }>(
    'SELECT COUNT(*) AS count FROM customers WHERE shop_id = ?',
    [shopId]
  );
  const { data: latest } = useQuery<{ id: string; name: string; created_at: string }>(
    'SELECT id, name, created_at FROM customers WHERE shop_id = ? ORDER BY created_at DESC LIMIT 5',
    [shopId]
  );
  const count = countRows[0]?.count ?? 0;

  async function addTestCustomer() {
    if (!shop) {
      return;
    }
    setIsAdding(true);
    try {
      const now = new Date().toISOString();
      // Écriture dans la base LOCALE : instantanée, même sans internet
      await db.execute(
        `INSERT INTO customers (id, shop_id, name, created_by, device_id, created_at, updated_at)
         VALUES (uuid(), ?, ?, ?, ?, ?, ?)`,
        [
          shop.id,
          t('syncTest.customerName', { number: count + 1, device: deviceName }),
          shop.memberId,
          // L'appareil n'est indiqué que s'il est déjà enregistré sur le serveur
          device?.number ? device.id : null,
          now,
          now,
        ]
      );
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Card mode="outlined">
      <Card.Title title={t('syncTest.title')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.md }}>
        <Text variant="bodyLarge">{t('syncTest.help')}</Text>
        <BigButton
          icon="account-plus"
          onPress={addTestCustomer}
          loading={isAdding}
          disabled={isAdding || !shop}>
          {t('syncTest.add')}
        </BigButton>
        <Text variant="titleMedium">{t('syncTest.count', { count })}</Text>
        {latest.map((customer) => (
          <List.Item
            key={customer.id}
            title={customer.name}
            left={(props) => <List.Icon {...props} icon="account" />}
          />
        ))}
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('syncTest.temporary')}
        </Text>
      </Card.Content>
    </Card>
  );
}
