import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useActionContext } from '@/data/use-action-context';
import { createProduct } from '@/products/product-actions';
import { ProductForm } from '@/products/product-form';
import {
  emptyProductInput,
  type ProductErrors,
  type ProductInput,
  parseProductInput,
} from '@/products/product-form-values';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';

const NO_ERRORS: ProductErrors = { fields: {}, packagings: {} };

/** Nouveau produit. Le code-barres peut arriver déjà rempli (produit inconnu scanné à la caisse). */
export default function NewProductScreen() {
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();

  const [values, setValues] = useState<ProductInput>(() => ({
    ...emptyProductInput(),
    barcode: barcode ?? '',
  }));
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProductErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!can('catalog.edit')) {
    return (
      <Screen title={t('productForm.newTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleSave() {
    if (!shop || !context) {
      return;
    }
    const result = parseProductInput(values, shop.currencyCode, {
      requirePrice: can('prices.edit'),
    });
    if (!result.success) {
      setErrors(result.errors);
      setFormError(t('productForm.fixErrors'));
      return;
    }
    setErrors(NO_ERRORS);
    setFormError(null);
    setIsSaving(true);
    try {
      const productId = await createProduct(db, context, result.data, photo);
      router.replace(`/product/${productId}`);
    } catch (error) {
      console.warn('Enregistrement du produit impossible :', error);
      setFormError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('productForm.newTitle')} stack>
      <ProductForm
        productId={null}
        photoPath={null}
        values={values}
        onChange={setValues}
        errors={errors}
        photo={photo}
        onPhotoChange={setPhoto}
        formError={formError}
        isSaving={isSaving}
        onSave={handleSave}
      />
    </Screen>
  );
}
