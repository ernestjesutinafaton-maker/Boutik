import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

import { useProductPhoto } from './photos';

type ProductPhotoProps = {
  productId: string;
  photoPath: string | null;
  size?: number;
  /** Photo choisie mais pas encore enregistrée (formulaire) */
  previewUri?: string | null;
};

/** La photo d'un produit (gardée en cache pour s'afficher hors ligne), ou une icône à défaut. */
export function ProductPhoto({ productId, photoPath, size = 56, previewUri }: ProductPhotoProps) {
  const theme = useAppTheme();
  const saved = useProductPhoto(productId, photoPath);
  const uri = previewUri ?? saved;
  const frame = {
    width: size,
    height: size,
    borderRadius: theme.app.radius.sm,
    backgroundColor: theme.colors.surfaceVariant,
  };

  if (!uri) {
    return (
      <View style={[styles.center, frame]}>
        <Icon source="package-variant" size={size * 0.55} color={theme.colors.onSurfaceVariant} />
      </View>
    );
  }
  return <Image source={{ uri }} style={frame} contentFit="cover" cachePolicy="disk" />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
