import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { type ProfileResult, updateMyProfile } from '@/team/my-profile';
import { joinNameSchema, pinSchema } from '@/team/schemas';
import { useAppTheme } from '@/theme/paper-theme';

type Fields = { name: string; pin: string; pinConfirmation: string };

/**
 * « Mon profil » : chacun change son nom et son code PIN (celui qui sert sur l'appareil
 * partagé de la boutique). Les rôles, eux, sont choisis par le propriétaire.
 */
export default function ProfileScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const { member } = useActiveMember();
  const [fields, setFields] = useState<Fields>({
    name: member?.name ?? '',
    pin: '',
    pinConfirmation: '',
  });
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { spacing } = theme.app;
  // Seulement son propre profil : sur l'appareil partagé, un profil à code PIN sans compte
  // se modifie dans Équipe, par le propriétaire
  const isMine = Boolean(member && shop && member.id === shop.memberId);

  if (!isMine || !member) {
    return (
      <Screen title={t('profile.title')} stack>
        <Notice tone="info" message={t('profile.notMine')} />
      </Screen>
    );
  }

  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  async function save() {
    setResult(null);
    const name = joinNameSchema.safeParse({ name: fields.name });
    const wantsPin = fields.pin !== '' || fields.pinConfirmation !== '';
    const pin = wantsPin
      ? pinSchema.safeParse({ pin: fields.pin, pinConfirmation: fields.pinConfirmation })
      : null;
    const found: FieldErrors<Fields> = {
      ...(name.success ? {} : firstErrorPerField(name.error)),
      ...(pin && !pin.success ? firstErrorPerField(pin.error) : {}),
    };
    setErrors(found);
    if (!name.success || (pin && !pin.success) || Object.keys(found).length > 0) return;

    setIsSaving(true);
    try {
      const outcome = await updateMyProfile(name.data.name || null, pin ? pin.data.pin : null);
      setResult(outcome);
      if (outcome === 'ok') {
        setFields((current) => ({ ...current, pin: '', pinConfirmation: '' }));
      }
    } finally {
      setIsSaving(false);
    }
  }

  const fieldError = (key: keyof Fields) => {
    const message = errors[key];
    return message ? t(message) : null;
  };

  return (
    <Screen title={t('profile.title')} stack>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('profile.help')}
      </Text>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          <Text variant="titleMedium">
            {t('profile.roles', {
              roles: member.roles.map((role) => t(`roles.${role}`)).join(', '),
            })}
          </Text>
          <TextField
            label={t('profile.name')}
            value={fields.name}
            onChangeText={set('name')}
            errorMessage={fieldError('name')}
          />
          <TextField
            label={t('profile.newPin')}
            value={fields.pin}
            onChangeText={set('pin')}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            errorMessage={fieldError('pin')}
          />
          <TextField
            label={t('profile.pinConfirmation')}
            value={fields.pinConfirmation}
            onChangeText={set('pinConfirmation')}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            errorMessage={fieldError('pinConfirmation')}
          />
        </Card.Content>
      </Card>
      {result === 'ok' ? <Notice tone="info" message={t('profile.saved')} /> : null}
      {result === 'offline' ? <Notice message={t('profile.offline')} /> : null}
      {result === 'failed' ? <Notice message={t('profile.failed')} /> : null}
      <BigButton icon="content-save" loading={isSaving} disabled={isSaving} onPress={save}>
        {t('profile.save')}
      </BigButton>
    </Screen>
  );
}
