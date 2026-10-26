import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { formatDay } from '@/domain/dates';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { useAppTheme } from '@/theme/paper-theme';

type SalesChartProps = {
  series: { day: string; total: number; count: number }[];
  currency: CurrencyCode;
};

const CHART_HEIGHT = 140;

/**
 * Les ventes jour par jour, en barres (une seule série : pas de légende, le titre la nomme).
 * Toucher une barre affiche le montant et le nombre de ventes de ce jour.
 */
export function SalesChart({ series, currency }: SalesChartProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(series.length - 1);
  const max = Math.max(...series.map((entry) => entry.total), 1);
  const current = series[Math.min(selected, series.length - 1)];
  const labelIndexes = new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]);

  return (
    <View style={{ gap: theme.app.spacing.sm }}>
      {current ? (
        <Text variant="bodyLarge" style={styles.bold}>
          {t('dashboard.chartValue', {
            day: formatDay(current.day).slice(0, 5),
            amount: formatMoney(current.total, currency),
            count: current.count,
          })}
        </Text>
      ) : null}
      <View
        style={[styles.bars, { height: CHART_HEIGHT, borderBottomColor: theme.app.colors.border }]}
        accessibilityRole="summary">
        {series.map((entry, index) => {
          const height = entry.total > 0 ? Math.max((entry.total / max) * CHART_HEIGHT, 4) : 0;
          const isSelected = index === selected;
          return (
            <Pressable
              key={entry.day}
              onPress={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityLabel={`${formatDay(entry.day)} : ${formatMoney(entry.total, currency)}`}
              // Zone à toucher plus grande que la barre elle-même
              style={[styles.slot, { height: CHART_HEIGHT }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: theme.colors.primary,
                    opacity: isSelected ? 1 : 0.55,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {series.map((entry, index) => (
          <Text
            key={entry.day}
            variant="labelSmall"
            numberOfLines={1}
            style={[
              styles.label,
              { color: theme.colors.onSurfaceVariant },
              index === selected && styles.bold,
            ]}>
            {labelIndexes.has(index) || index === selected ? formatDay(entry.day).slice(0, 5) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    gap: 2,
  },
  slot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    gap: 2,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    overflow: 'visible',
  },
  bold: {
    fontWeight: '700',
  },
});
