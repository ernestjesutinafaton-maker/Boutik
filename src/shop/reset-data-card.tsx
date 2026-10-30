import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/shop/shop-provider';
import { useIsPlatformAdmin, useSubscription } from '@/subscription/subscription-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const CONFIRMATION = 'EFFACER';

type Outcome = 'done' | 'pending' | 'forbidden' | 'offline';

/**
 * « Effacer toutes les données de test » : réservé au propriétaire, pendant l'essai gratuit
 * (ou à l'administrateur Boutik). Le vrai contrôle est fait par le serveur (reset_shop_data).
 */
export function ResetDataCard() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const db = usePowerSync();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const subscription = useSubscription();
  const isPlatformAdmin = useIsPlatformAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const allowed = can('data.delete') && (subscription?.state === 'trial' || isPlatformAdmin);
  if (!shop || !allowed) {
    return null;
  }
  const shopId = shop.id;

  async function handleReset() {
    setIsOpen(false);
    setTyped('');
    setIsWorking(true);
    try {
      // Des opérations pas encore envoyées seraient renvoyées après l'effacement : on attend
      const stats = await db.getUploadQueueStats();
      if (stats.count > 0) {
        setOutcome('pending');
        return;
      }
      const { error } = await supabase.rpc('reset_shop_data', {
        p_shop_id: shopId,
        p_confirmation: CONFIRMATION,
      });
      if (error) {
        setOutcome(error.code === '42501' ? 'forbidden' : 'offline');
        return;
      }
      // Les fichiers en attente qui ne concernent que cet appareil
      await db.writeTransaction(async (tx) => {
        await tx.execute('DELETE FROM local_outbox');
        await tx.execute('DELETE FROM local_photo_uploads');
        await tx.execute('DELETE FROM local_rejected_changes');
      });
      setOutcome('done');
    } catch {
      setOutcome('offline');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Card mode="outlined" style={{ borderColor: theme.app.colors.danger }}>
      <Card.Title title={t('reset.title')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.md }}>
        <Text variant="bodyLarge">{t('reset.help')}</Text>
        {outcome ? (
          <Notice tone={outcome === 'done' ? 'info' : 'error'} message={t(`reset.${outcome}`)} />
        ) : null}
        <BigButton
          icon="delete-forever"
          variant="danger"
          loading={isWorking}
          disabled={isWorking}
          onPress={() => setIsOpen(true)}>
          {t('reset.button')}
        </BigButton>
      </Card.Content>

      <Portal>
        <Dialog visible={isOpen} onDismiss={() => setIsOpen(false)}>
          <Dialog.Title>{t('reset.confirmTitle')}</Dialog.Title>
          <Dialog.Content style={{ gap: theme.app.spacing.md }}>
            <Text variant="bodyLarge">{t('reset.confirmText', { word: CONFIRMATION })}</Text>
            <TextField
              label={t('reset.typeWord', { word: CONFIRMATION })}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsOpen(false)}>{t('common.cancel')}</Button>
            <Button
              textColor={theme.app.colors.danger}
              disabled={typed.trim().toUpperCase() !== CONFIRMATION}
              onPress={handleReset}>
              {t('reset.button')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
}
