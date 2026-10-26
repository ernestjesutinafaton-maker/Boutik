import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Divider, List, Text } from 'react-native-paper';

import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { formatDay, formatMoment, toDay } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { supabase } from '@/lib/supabase';
import { useIsPlatformAdmin } from '@/subscription/subscription-data';
import { useAppTheme } from '@/theme/paper-theme';

type AdminPayment = {
  id: string;
  shop_name: string;
  months: number;
  amount: number;
  operator: string;
  sender_phone: string;
  reference: string;
  status: 'pending' | 'validated' | 'rejected';
  created_at: string;
  paid_until: string | null;
};

/**
 * Administration (Ernest seulement) : les paiements d'abonnement déclarés par les boutiques.
 * Vérifie la réception sur le téléphone Mobile Money, puis valide ou refuse.
 */
export default function AdminPaymentsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isAdmin = useIsPlatformAdmin();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    supabase.rpc('admin_subscription_payments').then(({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError) setError(t('subscription.offline'));
      else setPayments((data ?? []) as AdminPayment[]);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, reload, t]);

  async function review(id: string, accept: boolean) {
    const { error: reviewError } = await supabase.rpc('review_subscription_payment', {
      p_payment_id: id,
      p_accept: accept,
      p_note: '',
    });
    if (reviewError) setError(t('errors.unknown'));
    setReload((value) => value + 1);
  }

  if (!isAdmin) {
    return (
      <Screen title={t('subscription.adminTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('subscription.adminTitle')} stack>
      <Notice tone="info" message={t('subscription.adminHelp')} />
      {error ? <Notice message={error} /> : null}
      <Card mode="outlined">
        {payments.length === 0 ? (
          <Card.Content>
            <Text variant="bodyLarge">{t('subscription.adminEmpty')}</Text>
          </Card.Content>
        ) : null}
        {payments.map((payment, index) => (
          <View key={payment.id}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={`${payment.shop_name} · ${formatMoney(Number(payment.amount), 'XOF')}`}
              titleStyle={{ fontWeight: '700' }}
              description={[
                t('subscription.months', { count: payment.months }),
                payment.operator.toUpperCase(),
                payment.sender_phone,
                `Réf. ${payment.reference}`,
                formatMoment(payment.created_at),
                payment.paid_until ? `→ ${formatDay(toDay(new Date(payment.paid_until)))}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              descriptionNumberOfLines={3}
              right={() =>
                payment.status === 'pending' ? (
                  <View style={{ gap: theme.app.spacing.xs, justifyContent: 'center' }}>
                    <Button mode="contained" compact onPress={() => review(payment.id, true)}>
                      {t('subscription.validate')}
                    </Button>
                    <Button
                      compact
                      textColor={theme.app.colors.danger}
                      onPress={() => review(payment.id, false)}>
                      {t('subscription.reject')}
                    </Button>
                  </View>
                ) : (
                  <View style={{ justifyContent: 'center' }}>
                    <StatusChip
                      tone={payment.status === 'validated' ? 'ok' : 'danger'}
                      label={t(`subscription.paymentStatus.${payment.status}`)}
                    />
                  </View>
                )
              }
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
