import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomNav } from '@/components/navigation/bottom-nav';
import { NAV_ITEMS } from '@/components/navigation/nav-items';
import { SideNav } from '@/components/navigation/side-nav';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Navigation principale entre les 5 rubriques.
 *   - Petit écran (téléphone) : barre de navigation en bas.
 *   - Grand écran (tablette en paysage, ordinateur) : menu sur le côté gauche.
 * La mise en page change toute seule quand on tourne la tablette
 * ou qu'on redimensionne la fenêtre.
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= theme.app.layout.largeScreenMinWidth;

  return (
    <Tabs style={styles.fill}>
      {/* Liste des onglets, invisible : elle sert seulement à déclarer les écrans.
          Les boutons visibles sont dessinés par BottomNav ou SideNav. */}
      <TabList style={styles.hidden}>
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} />
        ))}
      </TabList>

      <View style={[styles.fill, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>
        {isLargeScreen && <SideNav />}
        <TabSlot style={styles.fill} />
        {!isLargeScreen && <BottomNav />}
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
