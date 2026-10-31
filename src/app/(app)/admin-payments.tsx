import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { CardList } from '@/components/card-list';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import { SUBSCRIPTION_OPERATORS } from '@/config/subscription';
import { formatDay, formatMoment, formatTime, toDay } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { supabase } from '@/lib/supabase';
import { proofUrls } from '@/subscription/payment-proof';
import { useIsPlatformAdmin } from '@/subscription/subscription-data';
import { useAppTheme } from '@/theme/paper-theme';

/** Un paiement déclaré, tel que le renvoie admin_subscription_payments (champs vides = null). */
type AdminPayment = {
  id: string;
  shop_name: string;
  shop_phone: string | null;
  owner_email: string | null;
  months: number;
  amount: number;
  operator: string;
  sender_phone: string;
  reference: string;
  paid_at: string | null;
  message: string | null;
  proof_path: string | null;
  status: 'pending' | 'validated' | 'rejected';
  review_note: string | null;
  created_at: string;
  paid_until: string | null;
};

type Overview = {
  shops_total: number;
  shops_trial: number;
  shops_active: number;
  shops_grace: number;
  shops_expired: number;
  shops_new_30_days: number;
  payments_pending: number;
  revenue_this_month: number;
  revenue_total: number;
};

const operatorLabel = (code: string) =>
  SUBSCRIPTION_OPERATORS.find((item) => item.code === code)?.label ?? code;

/**
 * Administration (Ernest seulement) : les paiements d'abonnement déclarés par les boutiques.
 * Pour chacun : la capture, l'heure du paiement, le message et le contact de la boutique.
 * Vérifier auprès de celui qui a reçu l'argent, puis valider (avec confirmation) ou refuser
 * (avec une raison, que le client verra).
 */
export default function AdminPaymentsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isAdmin = useIsPlatformAdmin();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toValidate, setToValidate] = useState<AdminPayment | null>(null);
  const [toReject, setToReject] = useState<AdminPayment | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const { spacing } = theme.app;

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    supabase.rpc('admin_subscription_payments').then(async ({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError) {
        setError(t('subscription.offline'));
        return;
      }
      const list = (data ?? []) as AdminPayment[];
      setPayments(list);
      // Les captures sont privées : adresses temporaires (1 heure), demandées en une fois
      const paths = list.flatMap((payment) => (payment.proof_path ? [payment.proof_path] : []));
      const signed = await proofUrls(paths);
      if (!cancelled) setUrls(signed);
    });
    // Les chiffres de la plateforme (calculés par le serveur, réservé à l'administrateur)
    supabase.rpc('admin_overview').then(({ data }) => {
      if (!cancelled && data?.[0]) setOverview(data[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, reload, t]);

  async function review(payment: AdminPayment, accept: boolean, note: string): Promise<boolean> {
    const { error: reviewError } = await supabase.rpc('review_subscription_payment', {
      p_payment_id: payment.id,
      p_accept: accept,
      p_note: note,
    });
    if (reviewError) {
      setError(t('subscription.reviewError'));
      return false;
    }
    setError(null);
    setReload((value) => value + 1);
    return true;
  }

  if (!isAdmin) {
    return (
      <Screen title={t('subscription.adminTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const header = (
    <>
      {overview ? (
        <Card mode="outlined">
          <Card.Title title={t('admin.overview')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.xs }}>
            {(
              [
                ['admin.shopsTotal', String(overview.shops_total)],
                ['admin.shopsNew', String(overview.shops_new_30_days)],
                ['admin.shopsTrial', String(overview.shops_trial)],
                ['admin.shopsActive', String(overview.shops_active)],
                ['admin.shopsGrace', String(overview.shops_grace)],
                ['admin.shopsExpired', String(overview.shops_expired)],
                ['admin.pending', String(overview.payments_pending)],
                ['admin.revenueMonth', formatMoney(Number(overview.revenue_this_month), 'XOF')],
                ['admin.revenueTotal', formatMoney(Number(overview.revenue_total), 'XOF')],
              ] as const
            ).map(([key, value]) => (
              <View key={key} style={styles.between}>
                <Text variant="bodyLarge">{t(key)}</Text>
                <Text variant="bodyLarge" style={styles.bold}>
                  {value}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : null}
      <Notice tone="info" message={t('subscription.adminHelp')} />
      {error ? <Notice message={error} /> : null}
    </>
  );

  return (
    <Screen title={t('subscription.adminTitle')} stack scroll={false}>
      <CardList
        data={payments}
        keyExtractor={(payment) => payment.id}
        header={header}
        empty={<Text variant="bodyLarge">{t('subscription.adminEmpty')}</Text>}
        renderItem={(payment) => (
          <PaymentRow
            payment={payment}
            proofUrl={payment.proof_path ? (urls[payment.proof_path] ?? null) : null}
            onViewProof={setViewing}
            onValidate={() => setToValidate(payment)}
            onReject={() => setToReject(payment)}
          />
        )}
      />

      {toValidate ? (
        <Portal>
          <Dialog visible onDismiss={() => setToValidate(null)}>
            <Dialog.Title>{t('subscription.validateTitle')}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyLarge">
                {t('subscription.validateText', {
                  shop: toValidate.shop_name,
                  amount: formatMoney(Number(toValidate.amount), 'XOF'),
                  months: t('subscription.months', { count: toValidate.months }),
                })}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setToValidate(null)}>{t('common.cancel')}</Button>
              <Button
                mode="contained"
                onPress={async () => {
                  await review(toValidate, true, '');
                  setToValidate(null);
                }}>
                {t('subscription.validate')}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      ) : null}

      {toReject ? (
        <RejectDialog
          payment={toReject}
          onClose={() => setToReject(null)}
          onConfirm={async (reason) => {
            if (await review(toReject, false, reason)) setToReject(null);
          }}
        />
      ) : null}

      <ProofViewer url={viewing} onClose={() => setViewing(null)} />
    </Screen>
  );
}

/** Un paiement : tout ce qu'il faut pour vérifier, et les boutons pour décider. */
function PaymentRow({
  payment,
  proofUrl,
  onViewProof,
  onValidate,
  onReject,
}: {
  payment: AdminPayment;
  proofUrl: string | null;
  onViewProof: (url: string) => void;
  onValidate: () => void;
  onReject: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { spacing, radius } = theme.app;
  const muted = { color: theme.colors.onSurfaceVariant };
  const whatsapp = payment.shop_phone?.replace(/\D/g, '') ?? '';

  return (
    <View style={{ padding: spacing.md, gap: spacing.xs }}>
      <View style={styles.between}>
        <Text variant="titleMedium" style={[styles.bold, styles.fill]}>
          {payment.shop_name} · {formatMoney(Number(payment.amount), 'XOF')}
        </Text>
        <StatusChip
          tone={
            payment.status === 'validated'
              ? 'ok'
              : payment.status === 'rejected'
                ? 'danger'
                : 'warning'
          }
          label={t(`subscription.paymentStatus.${payment.status}`)}
        />
      </View>
      <Text variant="bodyMedium">
        {[
          t('subscription.months', { count: payment.months }),
          operatorLabel(payment.operator),
          payment.sender_phone,
          `Réf. ${payment.reference}`,
        ].join(' · ')}
      </Text>
      {payment.paid_at ? (
        <Text variant="bodyMedium" style={styles.bold}>
          {t('subscription.paidAtLine', {
            date: formatDay(toDay(new Date(payment.paid_at))),
            time: formatTime(payment.paid_at),
          })}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={muted}>
        {t('subscription.declaredAtLine', { date: formatMoment(payment.created_at) })}
        {payment.paid_until ? ` · → ${formatDay(toDay(new Date(payment.paid_until)))}` : ''}
      </Text>
      {payment.message ? (
        <Text variant="bodyMedium" style={styles.italic}>
          « {payment.message} »
        </Text>
      ) : null}
      {payment.shop_phone || payment.owner_email ? (
        <Text variant="bodySmall" style={muted}>
          {[payment.shop_phone, payment.owner_email].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {proofUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('subscription.viewProof')}
          onPress={() => onViewProof(proofUrl)}>
          <Image
            source={{ uri: proofUrl }}
            style={[
              styles.thumbnail,
              { borderRadius: radius.md, backgroundColor: theme.colors.surfaceVariant },
            ]}
            contentFit="contain"
          />
        </Pressable>
      ) : payment.proof_path ? null : (
        <Text variant="bodySmall" style={muted}>
          {t('subscription.noProof')}
        </Text>
      )}

      {payment.status === 'rejected' && payment.review_note ? (
        <Text variant="bodyMedium" style={{ color: theme.app.colors.danger }}>
          {t('subscription.rejectedReason', { reason: payment.review_note })}
        </Text>
      ) : null}

      <View style={[styles.wrap, { gap: spacing.sm, marginTop: spacing.xs }]}>
        {payment.status === 'pending' ? (
          <>
            <Button mode="contained" icon="check" onPress={onValidate}>
              {t('subscription.validate')}
            </Button>
            <Button icon="close" textColor={theme.app.colors.danger} onPress={onReject}>
              {t('subscription.reject')}
            </Button>
          </>
        ) : null}
        {whatsapp ? (
          <Button icon="whatsapp" onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)}>
            {t('subscription.contactWhatsApp')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** Refuser : la raison est obligatoire (le client la verra dans « Mes paiements »). */
function RejectDialog({
  payment,
  onClose,
  onConfirm,
}: {
  payment: AdminPayment;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);

  return (
    <Portal>
      <Dialog visible onDismiss={onClose}>
        <Dialog.Title>{t('subscription.rejectTitle')}</Dialog.Title>
        <Dialog.Content style={{ gap: 12 }}>
          <Text variant="bodyLarge">
            {payment.shop_name} · {formatMoney(Number(payment.amount), 'XOF')}
          </Text>
          <TextField
            label={t('subscription.rejectReason')}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={300}
            autoFocus
            errorMessage={missing ? t('subscription.rejectReasonMissing') : null}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>{t('common.cancel')}</Button>
          <Button
            onPress={async () => {
              if (!reason.trim()) {
                setMissing(true);
                return;
              }
              await onConfirm(reason.trim());
            }}>
            {t('subscription.reject')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

/** La capture en grand, pour lire le SMS (montant, heure, numéro de transaction). */
function ProofViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={url !== null} animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.app.colors.night,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}>
        <IconButton
          icon="close"
          iconColor={theme.app.colors.onNight}
          size={28}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
          style={styles.viewerClose}
        />
        {url ? <Image source={{ uri: url }} style={styles.fill} contentFit="contain" /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fill: { flex: 1 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  thumbnail: { width: '100%', height: 220 },
  viewerClose: { alignSelf: 'flex-end' },
});
