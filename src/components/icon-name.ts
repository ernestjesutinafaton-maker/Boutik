import type { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import type { ComponentProps } from 'react';

/**
 * Nom d'une icône (liste complète : https://pictogrammers.com/library/mdi/).
 * Grâce à ce type, une faute de frappe dans un nom d'icône est signalée tout de suite.
 */
export type IconName = ComponentProps<typeof MaterialDesignIcons>['name'];
