import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedButtons, Text } from 'react-native-paper';

import { useAuth } from '@/auth/auth-provider';
import { signInSchema, signUpSchema } from '@/auth/schemas';
import { AuthLayout } from '@/components/auth-layout';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { PasswordField } from '@/components/password-field';
import { TextField } from '@/components/text-field';
import { EMAIL_CONFIRMED_URL } from '@/config/site';
import { errorMessageKey } from '@/lib/error-messages';
import { supabase } from '@/lib/supabase';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useShop } from '@/shop/shop-provider';
import { PLACEHOLDER_MEMBER_NAME } from '@/team/invite-links';
import { acceptInvite, fetchInvite, type InviteDetails } from '@/team/invitations';
import { joinNameSchema, pinSchema } from '@/team/schemas';
import { useAppTheme } from '@/theme/paper-theme';

type Mode = 'new' | 'existing';
type JoinFields = {
  email: string;
  password: string;
  passwordConfirmation: string;
  name: string;
  pin: string;
  pinConfirmation: string;
};

/**
 * La page du lien d'invitation (accessible connecté ou non) : le futur membre voit la boutique et
 * les rôles choisis par le propriétaire, crée son compte (ou se connecte), choisit son code PIN et
 * peut écrire son nom. Puis il entre directement dans SON interface.
 */
export default function InvitationScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const { session, signOut } = useAuth();
  const { status: shopStatus, shop, reload } = useShop();
  const [attempt, setAttempt] = useState(0);
  // Le dernier lien lu, et pour quel essai : tant qu'il ne correspond pas, la lecture est en cours
  const [loaded, setLoaded] = useState<{ key: string; details: InviteDetails | null } | null>(null);
  const loadKey = `${code}:${attempt}`;
  // undefined = lecture en cours ; null = pas de réseau
  const invite = loaded?.key === loadKey ? loaded.details : undefined;
  const [mode, setMode] = useState<Mode>('new');
  const [fields, setFields] = useState<JoinFields>({
    email: '',
    password: '',
    passwordConfirmation: '',
    name: '',
    pin: '',
    pinConfirmation: '',
  });
  const [errors, setErrors] = useState<FieldErrors<JoinFields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const muted = { color: theme.colors.onSurfaceVariant };

  useEffect(() => {
    let cancelled = false;
    fetchInvite(code).then((details) => {
      if (cancelled) return;
      setLoaded({ key: loadKey, details });
      if (details) {
        // Proposer l'e-mail et le nom déjà donnés par le propriétaire (le membre peut les changer)
        setFields((current) => ({
          ...current,
          email: current.email || details.suggestedEmail || '',
          name:
            current.name ||
            (details.memberName && details.memberName !== PLACEHOLDER_MEMBER_NAME
              ? details.memberName
              : ''),
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, loadKey]);

  // Après avoir rejoint : on attend que la boutique soit chargée, puis on ouvre SON interface
  useEffect(() => {
    if (joined && shopStatus === 'ready') {
      router.replace('/');
    }
  }, [joined, shopStatus]);

  const set = (key: keyof JoinFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const fieldError = (key: keyof JoinFields) => (errors[key] ? t(errors[key]) : null);

  async function submit() {
    setFormError(null);
    setInfo(null);
    const name = joinNameSchema.safeParse({ name: fields.name });
    const pin = pinSchema.safeParse({ pin: fields.pin, pinConfirmation: fields.pinConfirmation });
    const account = session
      ? null
      : mode === 'new'
        ? signUpSchema.safeParse(fields)
        : signInSchema.safeParse(fields);
    const found: FieldErrors<JoinFields> = {
      ...(name.success ? {} : firstErrorPerField(name.error)),
      ...(pin.success ? {} : firstErrorPerField(pin.error)),
      ...(account && !account.success ? firstErrorPerField(account.error) : {}),
    };
    setErrors(found);
    if (!pin.success || Object.keys(found).length > 0) return;

    setIsSubmitting(true);
    try {
      if (!session) {
        if (mode === 'new') {
          const { data, error } = await supabase.auth.signUp({
            email: fields.email.trim(),
            password: fields.password,
            options: { emailRedirectTo: EMAIL_CONFIRMED_URL },
          });
          if (error) {
            setFormError(t(errorMessageKey(error)));
            return;
          }
          if (!data.session) {
            // La confirmation par e-mail est encore demandée par Supabase
            setInfo(t('invitation.checkEmail'));
            return;
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: fields.email.trim(),
            password: fields.password,
          });
          if (error) {
            setFormError(t(errorMessageKey(error)));
            return;
          }
        }
      }
      const result = await acceptInvite(code, fields.name, pin.data.pin);
      if (!result.ok) {
        setFormError(t(`invitation.errors.${result.reason}`));
        return;
      }
      setJoined(true);
      reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  const roles = (invite?.roles ?? []).map((role) => t(`roles.${role}`)).join(', ');

  let content;
  if (invite === undefined) {
    content = (
      <Text variant="bodyLarge" style={muted}>
        {t('invitation.loading')}
      </Text>
    );
  } else if (invite === null) {
    content = (
      <>
        <Notice message={t('invitation.offline')} />
        <BigButton icon="refresh" onPress={() => setAttempt((value) => value + 1)}>
          {t('invitation.retry')}
        </BigButton>
      </>
    );
  } else if (invite.status !== 'valid') {
    content = (
      <>
        <Notice message={t(`invitation.statuses.${invite.status}`)} />
        <BigButton icon="login" onPress={() => router.replace(session ? '/' : '/sign-in')}>
          {t('invitation.goToSignIn')}
        </BigButton>
      </>
    );
  } else if (joined) {
    content = <Notice tone="info" message={t('invitation.joining')} />;
  } else if (session && shopStatus === 'ready') {
    content = (
      <>
        <Notice tone="info" message={t('invitation.alreadySignedIn', { shop: shop?.name ?? '' })} />
        <BigButton icon="logout" variant="outline" onPress={() => signOut()}>
          {t('invitation.signOut')}
        </BigButton>
      </>
    );
  } else {
    content = (
      <>
        <Notice
          tone="info"
          message={t('invitation.intro', { shop: invite.shopName ?? '', roles })}
        />
        <Text variant="bodySmall" style={muted}>
          {t('invitation.rolesFixed')}
        </Text>
        {session ? null : (
          <>
            <SegmentedButtons
              value={mode}
              onValueChange={(value) => setMode(value === 'existing' ? 'existing' : 'new')}
              buttons={[
                { value: 'new', label: t('invitation.newAccount') },
                { value: 'existing', label: t('invitation.existingAccount') },
              ]}
            />
            <TextField
              label={t('auth.email')}
              value={fields.email}
              onChangeText={set('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              errorMessage={fieldError('email')}
            />
            <PasswordField
              label={t('auth.password')}
              value={fields.password}
              onChangeText={set('password')}
              autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
              textContentType={mode === 'new' ? 'newPassword' : 'password'}
              errorMessage={fieldError('password')}
            />
            {mode === 'new' ? (
              <PasswordField
                label={t('auth.passwordConfirmation')}
                value={fields.passwordConfirmation}
                onChangeText={set('passwordConfirmation')}
                autoComplete="new-password"
                textContentType="newPassword"
                errorMessage={fieldError('passwordConfirmation')}
              />
            ) : null}
          </>
        )}
        <TextField
          label={t('invitation.name')}
          value={fields.name}
          onChangeText={set('name')}
          autoCapitalize="words"
          maxLength={60}
          errorMessage={fieldError('name')}
        />
        <PasswordField
          label={t('invitation.pin')}
          value={fields.pin}
          onChangeText={set('pin')}
          keyboardType="number-pad"
          maxLength={4}
          errorMessage={fieldError('pin')}
        />
        <PasswordField
          label={t('invitation.pinConfirmation')}
          value={fields.pinConfirmation}
          onChangeText={set('pinConfirmation')}
          keyboardType="number-pad"
          maxLength={4}
          onSubmitEditing={submit}
          errorMessage={fieldError('pinConfirmation')}
        />
        <Text variant="bodySmall" style={muted}>
          {t('invitation.pinHelp')}
        </Text>
        {formError ? <Notice message={formError} /> : null}
        {info ? <Notice tone="info" message={info} /> : null}
        <BigButton
          icon="account-check"
          onPress={submit}
          loading={isSubmitting}
          disabled={isSubmitting}>
          {session
            ? t('invitation.join')
            : mode === 'new'
              ? t('invitation.createAndJoin')
              : t('invitation.signInAndJoin')}
        </BigButton>
      </>
    );
  }

  return (
    <AuthLayout title={t('invitation.title')} subtitle={invite?.shopName ?? undefined}>
      {content}
    </AuthLayout>
  );
}
