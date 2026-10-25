import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

import { type SignUpInput, signUpSchema } from '@/auth/schemas';
import { AuthLayout } from '@/components/auth-layout';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { PasswordField } from '@/components/password-field';
import { TextField } from '@/components/text-field';
import type { TranslationKey } from '@/i18n/keys';
import { errorMessageKey } from '@/lib/error-messages';
import { supabase } from '@/lib/supabase';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';

/** Écran de création du compte du propriétaire. */
export default function SignUpScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignUpInput>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [mustConfirmEmail, setMustConfirmEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse({ email, password, passwordConfirmation });
    if (!parsed.success) {
      setFieldErrors(firstErrorPerField(parsed.error));
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setIsSubmitting(false);
    if (error) {
      setFormError(errorMessageKey(error));
      return;
    }
    // Sans session, Supabase attend que l'adresse e-mail soit confirmée.
    // Avec une session, l'application passe toute seule à la création de la boutique.
    if (!data.session) {
      setMustConfirmEmail(true);
    }
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} subtitle={t('auth.signUpSubtitle')}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        errorMessage={fieldErrors.email ? t(fieldErrors.email) : null}
      />
      <PasswordField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        errorMessage={fieldErrors.password ? t(fieldErrors.password) : null}
      />
      <PasswordField
        label={t('auth.passwordConfirmation')}
        value={passwordConfirmation}
        onChangeText={setPasswordConfirmation}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSubmit}
        errorMessage={fieldErrors.passwordConfirmation ? t(fieldErrors.passwordConfirmation) : null}
      />
      {formError ? <Notice message={t(formError)} /> : null}
      {mustConfirmEmail ? <Notice tone="info" message={t('auth.checkEmail')} /> : null}
      <BigButton
        icon="account-plus"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}>
        {t('auth.signUp')}
      </BigButton>
      <Button mode="text" onPress={() => router.back()}>
        {t('auth.haveAccount')}
      </Button>
    </AuthLayout>
  );
}
