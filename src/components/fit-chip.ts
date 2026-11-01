import { StyleSheet } from 'react-native';

/**
 * Pour toutes les puces (Chip) : une étiquette trop longue pour l'écran (nom d'un mode de
 * paiement, d'une unité, d'un rayon, d'une adresse…) est raccourcie avec « … » au lieu de
 * sortir de l'écran — même sur un petit téléphone de 360 pixels de large.
 */
export const fitChip = StyleSheet.create({
  chip: {
    maxWidth: '100%',
  },
  text: {
    flexShrink: 1,
  },
});
