import { usePowerSync } from '@powersync/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, Switch, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { PasswordField } from '@/components/password-field';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { errorMessageKey } from '@/lib/error-messages';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { MemberFields } from '@/team/member-fields';
import { type MemberInput, memberSchema, type PinInput, pinSchema } from '@/team/schemas';
import { setMemberPin, updateMember } from '@/team/team-actions';
import { type TeamMember, useTeamMembers } from '@/team/team-data';
import { useAppTheme } from '@/theme/paper-theme';

/** Fiche d'une personne de l'équipe : nom, rôles, remise maximale, code PIN, active ou non. */
export default function MemberScreen() {
  const { t } = useTranslation();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { can } = useActiveMember();
  const { members, isLoading } = useTeamMembers();
  const member = members.find((candidate) => candidate.id === memberId);

  if (!can('team.manage')) {
    return (
      <Screen title={t('team.editTitle')} stack>
        <Notice message={t('team.forbidden')} />
      </Screen>
    );
  }
  if (!member) {
    return (
      <Screen title={t('team.editTitle')} stack>
        {isLoading ? null : <Notice message={t('team.notFound')} />}
      </Screen>
    );
  }
  // « key » : le formulaire repart des bonnes valeurs si on change de personne
  return <MemberEditor key={member.id} member={member} />;
}

function MemberEditor({ member }: { member: TeamMember }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const isAccountOwner = member.id === shop?.memberId;

  const [values, setValues] = useState<MemberInput>({
    name: member.name,
    roles: member.roles,
    maxDiscountPercent: member.maxDiscountPercent === null ? '' : String(member.maxDiscountPercent),
  });
  const [active, setActive] = useState(member.active);
  const [errors, setErrors] = useState<FieldErrors<MemberInput>>({});
  const [pins, setPins] = useState<PinInput>({ pin: '', pinConfirmation: '' });
  const [pinErrors, setPinErrors] = useState<FieldErrors<PinInput>>({});
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const parsed = memberSchema.safeParse(values);
    setErrors(parsed.success ? {} : firstErrorPerField(parsed.error));
    if (!parsed.success || !context) {
      return;
    }
    setIsSaving(true);
    try {
      await updateMember(db, context, member, {
        ...parsed.data,
        // Le compte du propriétaire garde toujours son rôle et reste dans l'équipe
        roles: isAccountOwner ? member.roles : parsed.data.roles,
        active: isAccountOwner ? true : active,
      });
      setNotice({ tone: 'info', text: t('team.saved') });
    } catch (error) {
      setNotice({ tone: 'error', text: t(errorMessageKey(error)) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePin() {
    const parsed = pinSchema.safeParse(pins);
    setPinErrors(parsed.success ? {} : firstErrorPerField(parsed.error));
    if (!parsed.success || !context) {
      return;
    }
    try {
      await setMemberPin(db, context, member.id, parsed.data.pin);
      setPins({ pin: '', pinConfirmation: '' });
      setNotice({ tone: 'info', text: t('team.pinChanged') });
    } catch (error) {
      setNotice({ tone: 'error', text: t(errorMessageKey(error)) });
    }
  }

  return (
    <Screen title={member.name} stack>
      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          {isAccountOwner ? (
            <>
              <Notice tone="info" message={t('team.accountOwnerHelp')} />
              <TextField
                label={t('team.name')}
                value={values.name}
                onChangeText={(name) => setValues({ ...values, name })}
                errorMessage={errors.name ? t(errors.name) : null}
              />
            </>
          ) : (
            <>
              <MemberFields values={values} onChange={setValues} errors={errors} />
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.app.spacing.md }}>
                <Switch value={active} onValueChange={setActive} />
                <Text variant="bodyLarge">{active ? t('team.active') : t('team.inactive')}</Text>
              </View>
            </>
          )}
          <BigButton
            icon="content-save"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}>
            {t('team.save')}
          </BigButton>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('team.changePin')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          <PasswordField
            label={t('team.newPin')}
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
          <BigButton variant="outline" icon="lock-reset" onPress={handlePin}>
            {t('team.changePin')}
          </BigButton>
        </Card.Content>
      </Card>
    </Screen>
  );
}
