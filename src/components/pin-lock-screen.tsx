import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, List, Portal, Text } from 'react-native-paper';

import { useActiveMember } from '@/team/active-member-provider';
import type { TeamMember } from '@/team/team-data';
import { useAppTheme } from '@/theme/paper-theme';

import { AuthLayout } from './auth-layout';
import { Notice } from './notice';
import { PasswordField } from './password-field';
import { PinPad } from './pin-pad';

/**
 * Écran « Qui êtes-vous ? » : sur l'appareil partagé de la boutique, chaque personne
 * touche son nom puis tape son code PIN. Tout se vérifie dans l'appareil, sans internet.
 */
export function PinLockScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { lockableMembers, unlock, unlockWithPassword, blockedUntil } = useActiveMember();
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const isBlocked = blockedUntil !== null && now < blockedUntil;
  const secondsLeft = isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0;

  // Pendant un blocage, l'affichage du temps restant se met à jour chaque seconde
  useEffect(() => {
    if (blockedUntil === null) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [blockedUntil]);

  function handlePin(pin: string) {
    if (!selected) {
      return;
    }
    const result = unlock(selected.id, pin);
    setNow(Date.now());
    if (result.status === 'wrong') {
      setMessage(t('lock.wrongPin', { count: result.remainingAttempts }));
    } else if (result.status === 'blocked') {
      setMessage(null);
    }
  }

  async function handlePassword() {
    setIsChecking(true);
    setPasswordError(null);
    const ok = await unlockWithPassword(password);
    setIsChecking(false);
    if (ok) {
      setIsForgotOpen(false);
      setPassword('');
    } else {
      setPasswordError(t('lock.wrongPassword'));
    }
  }

  return (
    <>
      <AuthLayout
        title={selected ? t('lock.enterPin', { name: selected.name }) : t('lock.title')}
        subtitle={selected ? undefined : t('lock.subtitle')}>
        {selected ? (
          <>
            {isBlocked ? (
              <Notice message={t('lock.blocked', { seconds: secondsLeft })} />
            ) : message ? (
              <Notice message={message} />
            ) : null}
            <PinPad onComplete={handlePin} disabled={isBlocked} />
            <Button
              mode="text"
              onPress={() => {
                setSelected(null);
                setMessage(null);
              }}>
              {t('lock.back')}
            </Button>
          </>
        ) : (
          <>
            {lockableMembers.length === 0 ? (
              <Notice tone="info" message={t('lock.noMembers')} />
            ) : null}
            {lockableMembers.map((member) => (
              <List.Item
                key={member.id}
                title={member.name}
                titleStyle={{ fontWeight: '700' }}
                description={member.roles.map((role) => t(`roles.${role}`)).join(', ')}
                left={(props) => <List.Icon {...props} icon="account-circle" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => setSelected(member)}
              />
            ))}
          </>
        )}
        <Button mode="text" onPress={() => setIsForgotOpen(true)}>
          {t('lock.forgot')}
        </Button>
      </AuthLayout>

      <Portal>
        <Dialog visible={isForgotOpen} onDismiss={() => setIsForgotOpen(false)}>
          <Dialog.Title>{t('lock.forgotTitle')}</Dialog.Title>
          <Dialog.Content style={{ gap: theme.app.spacing.md }}>
            <Text variant="bodyLarge">{t('lock.forgotText')}</Text>
            <PasswordField
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handlePassword}
              errorMessage={passwordError}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsForgotOpen(false)}>{t('account.cancel')}</Button>
            <Button onPress={handlePassword} loading={isChecking} disabled={isChecking}>
              {t('lock.unlock')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
