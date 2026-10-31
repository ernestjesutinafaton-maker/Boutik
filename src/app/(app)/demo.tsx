import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Icon3D } from '@/components/icon-3d';
import { Screen } from '@/components/screen';
import { useActionContext } from '@/data/use-action-context';
import { loadDemoData, ShopNotEmptyError } from '@/demo/load-demo';
import { today } from '@/domain/dates';
import { useCatalog } from '@/products/catalog-provider';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Remplir une boutique VIDE avec la boutique de démonstration (30 produits,
 * 30 jours de ventes, clients à crédit) pour découvrir l'appli ou la montrer.
 */
export default function DemoScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { device } = useShop();
  const { can } = useActiveMember();
  const { products, isLoading } = useCatalog();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  if (!can('settings.manage')) {
    return (
      <Screen title={t('demo.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleLoad() {
    if (!context || !device?.number) {
      setError(t('checkout.deviceNotRegistered'));
      return;
    }
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      await loadDemoData(db, context, {
        deviceNumber: device.number,
        today: today(),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setIsDone(true);
    } catch (loadError) {
      console.warn('Démonstration impossible :', loadError);
      setError(loadError instanceof ShopNotEmptyError ? t('demo.notEmpty') : t('errors.unknown'));
    } finally {
      setProgress(null);
    }
  }

  const notEmpty = !isLoading && products.length > 0 && !isDone && !progress;

  return (
    <Screen title={t('demo.title')} stack>
      <Icon3D name={isDone ? 'party' : 'store'} size={112} />
      <Notice tone="info" message={t('demo.help')} />
      {notEmpty ? <Notice message={t('demo.notEmpty')} /> : null}
      {progress ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: theme.app.spacing.sm }}>
            <Text variant="bodyLarge">
              {t('demo.progress', { done: progress.done, total: progress.total })}
            </Text>
            <ProgressBar progress={progress.done / progress.total} color={theme.colors.primary} />
          </Card.Content>
        </Card>
      ) : null}
      {isDone ? <Notice tone="info" message={t('demo.done')} /> : null}
      {error ? <Notice message={error} /> : null}
      {isDone ? (
        <BigButton icon="view-dashboard" onPress={() => router.navigate('/dashboard')}>
          {t('demo.open')}
        </BigButton>
      ) : (
        <BigButton
          icon="store-plus"
          variant="accent"
          onPress={handleLoad}
          loading={progress !== null}
          disabled={notEmpty || progress !== null}>
          {t('demo.load')}
        </BigButton>
      )}
      <BigButton icon="help-circle" variant="outline" onPress={() => router.push('/guide')}>
        {t('demo.guide')}
      </BigButton>
    </Screen>
  );
}
