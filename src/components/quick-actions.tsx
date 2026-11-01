import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useDeliveriesInUse } from '@/deliveries/delivery-data';
import type { Permission } from '@/domain/permissions';
import type { TranslationKey } from '@/i18n/keys';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { Icon3D, type Icon3DName } from './icon-3d';

type QuickAction = {
  label: TranslationKey;
  icon: Icon3DName;
  href: Href;
  /** Le droit nécessaire (absent : tout le monde ; une liste : l'un d'eux suffit) */
  permission?: Permission | readonly Permission[];
  /** Seulement si la boutique utilise les livraisons (un livreur, ou déjà une livraison) */
  deliveries?: boolean;
};

/** Les actions de tous les jours, dans l'ordre où on s'en sert le plus. */
const ACTIONS: QuickAction[] = [
  { label: 'quick.sell', icon: 'cart', href: '/', permission: 'sale.create' },
  { label: 'quick.sales', icon: 'receipt', href: '/sale', permission: 'sale.create' },
  {
    label: 'quick.deliveries',
    icon: 'scooter',
    href: '/delivery',
    permission: ['delivery.create', 'delivery.handover', 'delivery.review'],
    deliveries: true,
  },
  { label: 'quick.receive', icon: 'truck', href: '/stock/receive', permission: 'stock.receive' },
  { label: 'quick.newProduct', icon: 'package', href: '/product/new', permission: 'catalog.edit' },
  {
    label: 'quick.newCustomer',
    icon: 'ledger',
    href: '/customer/new',
    permission: 'customers.edit',
  },
  { label: 'quick.cash', icon: 'coin', href: '/cash', permission: 'cash.session' },
  { label: 'quick.inventory', icon: 'clipboard', href: '/inventory', permission: 'stock.count' },
  { label: 'quick.alerts', icon: 'warning', href: '/stock/alerts', permission: 'stock.receive' },
  { label: 'quick.reports', icon: 'bar-chart', href: '/report', permission: 'reports.account' },
  { label: 'quick.guide', icon: 'light-bulb', href: '/guide' },
];

/** Au plus deux rangées de 4 : le reste est dans les onglets et dans « Plus ». */
const MAX_ACTIONS = 8;

/**
 * Accès rapide : les actions courantes en tuiles (icône 3D + nom), en haut du tableau de bord.
 * Chacun ne voit que ce que son rôle permet : rien à chercher dans les menus.
 */
export function QuickActions() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { can } = useActiveMember();
  const deliveriesInUse = useDeliveriesInUse();
  const { colors, effects, depth, radius, spacing } = theme.app;
  const allowed = (permission: QuickAction['permission']) =>
    !permission ||
    (typeof permission === 'string' ? can(permission) : permission.some((one) => can(one)));
  const visible = ACTIONS.filter(
    (action) => allowed(action.permission) && (!action.deliveries || deliveriesInUse)
  ).slice(0, MAX_ACTIONS);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="titleMedium">{t('quick.title')}</Text>
      <View style={[styles.grid, { gap: spacing.sm }]}>
        {visible.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={t(action.label)}
            onPress={() => router.push(action.href)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderBottomColor: effects.cardEdge,
                borderBottomWidth: depth.card,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                gap: spacing.xs,
              },
              pressed && styles.pressed,
            ]}>
            <Icon3D name={action.icon} size={36} />
            <Text variant="labelMedium" numberOfLines={2} style={styles.label}>
              {t(action.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: 72,
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
