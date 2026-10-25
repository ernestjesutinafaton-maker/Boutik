import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';

import { useAuth } from '@/auth/auth-provider';
import { type CreateShopInput, createShopSchema } from '@/auth/schemas';
import { AuthLayout } from '@/components/auth-layout';
import { BigButton } from '@/components/big-button';
import { CountryPicker } from '@/components/country-picker';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { DEFAULT_COUNTRY_CODE, getCountry } from '@/config/countries';
import { CURRENCIES } from '@/domain/money';
import type { TranslationKey } from '@/i18n/keys';
import { errorMessageKey } from '@/lib/error-messages';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { clearShopCache, useShop } from '@/shop/shop-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Écran affiché juste après l'inscription : on crée la boutique. */
export default function CreateShopScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { createShop } = useShop();
  const { signOut } = useAuth();

  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<CreateShopInput>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const country = getCountry(countryCode);
  const currency = CURRENCIES[country.currency];

  async function handleSubmit() {
    setFormError(null);
    const parsed = createShopSchema.safeParse({ shopName, ownerName, countryCode });
    if (!parsed.success) {
      setFieldErrors(firstErrorPerField(parsed.error));
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      await createShop(parsed.data);
      // La boutique existe : l'application passe toute seule à l'écran principal.
    } catch (error) {
      setFormError(errorMessageKey(error));
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    await clearShopCache();
    await signOut();
  }

  return (
    <AuthLayout title={t('createShop.title')} subtitle={t('createShop.subtitle')}>
      <TextField
        label={t('createShop.shopName')}
        placeholder={t('createShop.shopNamePlaceholder')}
        value={shopName}
        onChangeText={setShopName}
        autoCapitalize="words"
        errorMessage={fieldErrors.shopName ? t(fieldErrors.shopName) : null}
      />
      <TextField
        label={t('createShop.ownerName')}
        value={ownerName}
        onChangeText={setOwnerName}
        autoCapitalize="words"
        autoComplete="name"
        errorMessage={fieldErrors.ownerName ? t(fieldErrors.ownerName) : null}
      />
      <CountryPicker value={countryCode} onChange={setCountryCode} />
      <Text variant="bodyLarge">
        {t('createShop.currency', { currency: `${currency.name} (${currency.symbol})` })}
      </Text>
      <Text variant="bodyLarge">
        {t('createShop.paymentMethods', {
          list: country.paymentMethods.map((method) => method.label).join(', '),
        })}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('createShop.paymentMethodsHelp')}
      </Text>
      {formError ? <Notice message={t(formError)} /> : null}
      <BigButton
        icon="store-plus"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}>
        {t('createShop.submit')}
      </BigButton>
      <Button mode="text" onPress={handleSignOut}>
        {t('createShop.wrongAccount')}
      </Button>
    </AuthLayout>
  );
}
