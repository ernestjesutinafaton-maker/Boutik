import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { useAppTheme } from '@/theme/paper-theme';
import type { ThemeColor } from '@/theme/tokens';

/**
 * Les icônes en 3D de Boutik (collection « Fluent Emoji » de Microsoft, licence MIT :
 * voir assets/images/3d/LICENSE-fluentui-emoji.txt). Images WebP de 160 × 160.
 * Elles servent aux grandes entrées de menu et aux illustrations ; les petits boutons
 * gardent des icônes simples (plus lisibles en petit).
 */
const SOURCES = {
  'bar-chart': require('@/assets/images/3d/bar-chart.webp'),
  'bookmark-tabs': require('@/assets/images/3d/bookmark-tabs.webp'),
  cart: require('@/assets/images/3d/cart.webp'),
  'chart-increasing': require('@/assets/images/3d/chart-increasing.webp'),
  clipboard: require('@/assets/images/3d/clipboard.webp'),
  coin: require('@/assets/images/3d/coin.webp'),
  crown: require('@/assets/images/3d/crown.webp'),
  gear: require('@/assets/images/3d/gear.webp'),
  hourglass: require('@/assets/images/3d/hourglass.webp'),
  ledger: require('@/assets/images/3d/ledger.webp'),
  'light-bulb': require('@/assets/images/3d/light-bulb.webp'),
  locked: require('@/assets/images/3d/locked.webp'),
  outbox: require('@/assets/images/3d/outbox.webp'),
  package: require('@/assets/images/3d/package.webp'),
  party: require('@/assets/images/3d/party.webp'),
  phone: require('@/assets/images/3d/phone.webp'),
  printer: require('@/assets/images/3d/printer.webp'),
  receipt: require('@/assets/images/3d/receipt.webp'),
  scroll: require('@/assets/images/3d/scroll.webp'),
  shield: require('@/assets/images/3d/shield.webp'),
  store: require('@/assets/images/3d/store.webp'),
  truck: require('@/assets/images/3d/truck.webp'),
  warning: require('@/assets/images/3d/warning.webp'),
  wastebasket: require('@/assets/images/3d/wastebasket.webp'),
} as const;

/** L'icône « équipe » existe dans la couleur de chaque thème. */
const TEAM: Record<ThemeColor, number> = {
  vert: require('@/assets/images/3d/team-vert.webp'),
  violet: require('@/assets/images/3d/team-violet.webp'),
  orange: require('@/assets/images/3d/team-orange.webp'),
};

export type Icon3DName = keyof typeof SOURCES | 'team';

/**
 * Une icône en 3D (décorative : le texte à côté dit déjà de quoi il s'agit).
 * Dans une ligne de liste : left={(props) => <Icon3D name="coin" style={props.style} />}
 */
export function Icon3D({
  name,
  size = 40,
  style,
}: {
  name: Icon3DName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useAppTheme();
  return (
    <Image
      source={name === 'team' ? TEAM[theme.app.themeColor] : SOURCES[name]}
      style={[{ width: size, height: size, alignSelf: 'center' }, style]}
      contentFit="contain"
      accessible={false}
    />
  );
}
