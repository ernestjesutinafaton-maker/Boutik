import { useStatus } from '@powersync/react';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { MoneyText } from '@/components/money-text';
import { StatusChip } from '@/components/status-chip';
import { formatMoment } from '@/domain/dates';
import type { CurrencyCode } from '@/domain/money';
import { useAppTheme } from '@/theme/paper-theme';

import type { DeliveryExpense } from './delivery-data';
import { useReceiptImage } from './delivery-proofs';

/** Une dépense : qui, quoi, combien, quand, pour quelle livraison. */
export function ExpenseLines({
  expense,
  currency,
  withStatus = false,
}: {
  expense: DeliveryExpense;
  currency: CurrencyCode;
  withStatus?: boolean;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 2 }}>
      <View style={[styles.between, { gap: theme.app.spacing.sm }]}>
        <Text variant="titleMedium" style={[styles.bold, styles.shrink]}>
          {`${expense.courierName} · ${t(`deliveries.expense.categories.${expense.category}`)}`}
        </Text>
        <MoneyText amount={expense.amount} currency={currency} />
      </View>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {[formatMoment(expense.occurredAt), expense.deliveryAddress, expense.note]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {withStatus ? (
        <View style={styles.start}>
          <StatusChip
            tone={
              expense.status === 'reimbursed'
                ? 'ok'
                : expense.status === 'rejected'
                  ? 'danger'
                  : 'warning'
            }
            label={
              expense.status === 'rejected' && expense.reviewNote
                ? t('deliveries.expense.rejectedReason', { reason: expense.reviewNote })
                : t(`deliveries.expense.status.${expense.status}`)
            }
          />
        </View>
      ) : null}
    </View>
  );
}

/** La photo du reçu (stockage privé : adresse temporaire, internet nécessaire). */
export function ReceiptPhoto({ path }: { path: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { connected } = useStatus();
  const image = useReceiptImage(path);
  if (image.uri) {
    return (
      <Image
        source={{ uri: image.uri }}
        style={[
          styles.photo,
          { borderRadius: theme.app.radius.md, backgroundColor: theme.colors.surfaceVariant },
        ]}
        contentFit="contain"
        accessibilityLabel={t('deliveries.expense.photo')}
      />
    );
  }
  if (image.status === 'loading') {
    return null;
  }
  return (
    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
      {connected ? t('deliveries.cash.photoPending') : t('deliveries.cash.photoOffline')}
    </Text>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  shrink: {
    flexShrink: 1,
  },
  bold: {
    fontWeight: '700',
  },
  start: {
    alignSelf: 'flex-start',
  },
  photo: {
    width: '100%',
    height: 240,
  },
});
