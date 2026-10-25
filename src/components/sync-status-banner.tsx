import { usePowerSync, useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import type { IconName } from '@/components/icon-name';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Le bandeau toujours visible en haut des écrans :
 * « En ligne · tout est à jour », « Synchronisation… », ou « Hors ligne · 3 opérations en attente ».
 */
export function SyncStatusBanner() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const status = useStatus();
  const [pending, setPending] = useState(0);
  const { colors, spacing, radius } = theme.app;

  // Nombre d'opérations faites dans l'appareil et pas encore envoyées au serveur
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const stats = await db.getUploadQueueStats();
        if (active) {
          setPending(stats.count);
        }
      } catch {
        // La base n'est peut-être pas encore prête : on réessaiera au prochain tour
      }
    }
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [db]);

  const isOnline = status.connected;
  const isFirstSync = !status.hasSynced;
  const isBusy =
    pending > 0 || status.dataFlowStatus.uploading || status.dataFlowStatus.downloading;

  let icon: IconName;
  let label: string;
  let backgroundColor: string;
  let color: string;
  if (!isOnline) {
    icon = 'cloud-off-outline';
    label = t('sync.offline');
    backgroundColor = colors.accentContainer;
    color = colors.onAccentContainer;
  } else if (isFirstSync || isBusy) {
    icon = 'cloud-sync-outline';
    label = t(isFirstSync ? 'sync.firstSync' : 'sync.syncing');
    backgroundColor = colors.surfaceVariant;
    color = colors.text;
  } else {
    icon = 'cloud-check-outline';
    label = t('sync.online');
    backgroundColor = colors.primaryContainer;
    color = colors.onPrimaryContainer;
  }

  const detail =
    pending > 0
      ? t('sync.pending', { count: pending })
      : isOnline && !isFirstSync
        ? t('sync.allSynced')
        : null;

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.banner,
        {
          backgroundColor,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        },
      ]}>
      <Icon source={icon} size={22} color={color} />
      <Text variant="bodyMedium" style={[styles.text, { color }]} numberOfLines={1}>
        <Text style={[styles.bold, { color }]}>{label}</Text>
        {detail ? ` · ${detail}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
});
