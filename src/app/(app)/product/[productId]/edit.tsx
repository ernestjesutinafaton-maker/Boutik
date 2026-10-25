import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useActionContext } from '@/data/use-action-context';
import type { CatalogProduct } from '@/domain/catalog';
import type { CurrencyCode } from '@/domain/money';
import { updateProduct } from '@/products/product-actions';
import { useProduct } from '@/products/product-data';
import { ProductForm } from '@/products/product-form';
import {
  type ProductErrors,
  type ProductInput,
  parseProductInput,
  productToInput,
} from '@/products/product-form-values';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';

const NO_ERRORS: ProductErrors = { fields: {}, packagings: {} };

/** Modifier un produit : nom, unités, prix (le changement de prix est noté dans le journal). */
export default function EditProductScreen() {
  const { t } = useTranslation();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { product, isLoading } = useProduct(productId);
  const { shop } = useShop();
  const { can } = useActiveMember();

  if (!can('catalog.edit')) {
    return (
      <Screen title={t('productForm.editTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!product || !shop) {
    return (
      <Screen title={t('productForm.editTitle')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }
  // Le formulaire n'est créé qu'une fois le produit chargé : il part de ses valeurs
  return <EditForm product={product} currency={shop.currencyCode} />;
}

function EditForm({ product, currency }: { product: CatalogProduct; currency: CurrencyCode }) {
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { can } = useActiveMember();
  const [values, setValues] = useState<ProductInput>(() => productToInput(product, currency));
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProductErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!context) {
      return;
    }
    const result = parseProductInput(values, currency, { requirePrice: can('prices.edit') });
    if (!result.success) {
      setErrors(result.errors);
      setFormError(t('productForm.fixErrors'));
      return;
    }
    setErrors(NO_ERRORS);
    setFormError(null);
    setIsSaving(true);
    try {
      await updateProduct(db, context, product, result.data, photo);
      router.back();
    } catch (error) {
      console.warn('Modification du produit impossible :', error);
      setFormError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('productForm.editTitle')} stack>
      <ProductForm
        productId={product.id}
        photoPath={product.photoPath}
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
