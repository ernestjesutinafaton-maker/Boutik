import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { PasswordField } from '@/components/password-field';
import { Screen } from '@/components/screen';
import { useActionContext } from '@/data/use-action-context';
import { errorMessageKey } from '@/lib/error-messages';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useActiveMember } from '@/team/active-member-provider';
import { MemberFields } from '@/team/member-fields';
import { type MemberInput, memberSchema, type PinInput, pinSchema } from '@/team/schemas';
import { createMember } from '@/team/team-actions';
import { useAppTheme } from '@/theme/paper-theme';

/** Ajouter une personne à l'équipe : nom, rôles, code PIN. */
export default function NewMemberScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { can, keepCurrentMember } = useActiveMember();

  const [values, setValues] = useState<MemberInput>({
    name: '',
    roles: ['seller'],
    maxDiscountPercent: '',
  });
  const [pins, setPins] = useState<PinInput>({ pin: '', pinConfirmation: '' });
  const [errors, setErrors] = useState<FieldErrors<MemberInput>>({});
  const [pinErrors, setPinErrors] = useState<FieldErrors<PinInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!can('team.manage')) {
    return (
      <Screen title={t('team.newTitle')} stack>
        <Notice message={t('team.forbidden')} />
      </Screen>
    );
  }

  async function handleSave() {
    const member = memberSchema.safeParse(values);
    const pin = pinSchema.safeParse(pins);
    setErrors(member.success ? {} : firstErrorPerField(member.error));
    setPinErrors(pin.success ? {} : firstErrorPerField(pin.error));
    if (!member.success || !pin.success || !context) {
      return;
    }
    setIsSaving(true);
    try {
      // La personne qui ajoute reste active : l'appareil ne se verrouille pas en pleine saisie
      keepCurrentMember();
      await createMember(db, context, { ...member.data, pin: pin.data.pin });
      router.back();
    } catch (error) {
      setFormError(t(errorMessageKey(error)));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('team.newTitle')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          <MemberFields values={values} onChange={setValues} errors={errors} />
          <PasswordField
            label={t('team.pin')}
            value={pins.pin}
            onChangeText={(pin) => setPins({ ...pins, pin })}
            keyboardType="number-pad"
            maxLength={4}
            errorMessage={pinErrors.pin ? t(pinErrors.pin) : null}
          />
          <PasswordField
            label={t('team.pinConfirmation')}
            value={pins.pinConfirmation}
            onChangeText={(pinConfirmation) => setPins({ ...pins, pinConfirmation })}
            keyboardType="number-pad"
            maxLength={4}
            errorMessage={pinErrors.pinConfirmation ? t(pinErrors.pinConfirmation) : null}
          />
          {formError ? <Notice message={formError} /> : null}
          <BigButton
            icon="content-save"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}>
            {t('team.save')}
          </BigButton>
        </Card.Content>
      </Card>
    </Screen>
  );
}
