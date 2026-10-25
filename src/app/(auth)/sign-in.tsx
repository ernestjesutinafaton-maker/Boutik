import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';

import { type SignInInput, signInSchema } from '@/auth/schemas';
import { AuthLayout } from '@/components/auth-layout';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { PasswordField } from '@/components/password-field';
import { TextField } from '@/components/text-field';
import type { TranslationKey } from '@/i18n/keys';
import { errorMessageKey } from '@/lib/error-messages';
import { supabase } from '@/lib/supabase';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useAppTheme } from '@/theme/paper-theme';

/** Écran de connexion du propriétaire (e-mail + mot de passe). */
export default function SignInScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignInInput>>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(firstErrorPerField(parsed.error));
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setIsSubmitting(false);
    if (error) {
      setFormError(errorMessageKey(error));
    }
    // Si tout va bien : la session change, et l'application passe toute seule à l'écran suivant.
  }

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
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
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
        errorMessage={fieldErrors.password ? t(fieldErrors.password) : null}
      />
      {formError ? <Notice message={t(formError)} /> : null}
      <BigButton icon="login" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
        {t('auth.signIn')}
      </BigButton>
      <Button mode="text" onPress={() => router.push('/sign-up')}>
        {t('auth.noAccount')}
      </Button>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('auth.firstTimeOnline')}
      </Text>
    </AuthLayout>
  );
}
