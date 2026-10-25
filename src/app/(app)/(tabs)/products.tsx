import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';

/** Rubrique « Produits » : construite aux étapes 8 à 10. */
export default function ProductsScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('nav.products')}>
      <ComingSoon icon="package-variant-closed" description={t('products.description')} step={8} />
    </Screen>
  );
}
