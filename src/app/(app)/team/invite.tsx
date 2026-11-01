import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelperText } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { type FieldErrors, firstErrorPerField } from '@/lib/validation';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { InviteShareCard } from '@/team/invite-share-card';
import { type CreatedInvite, inviteNewMember } from '@/team/invitations';
import { RoleChecklist } from '@/team/role-checklist';
import { type InviteInput, inviteSchema } from '@/team/schemas';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Inviter un membre avec un lien personnel : le propriétaire choisit ses rôles (le nom et l'e-mail
 * sont facultatifs). Le membre ouvre le lien, crée son compte et son code PIN — jamais ses rôles.
 */
export default function InviteMemberScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const { can, keepCurrentMember } = useActiveMember();
  const [values, setValues] = useState<InviteInput>({ name: '', email: '', roles: ['seller'] });
  const [errors, setErrors] = useState<FieldErrors<InviteInput>>({});
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { spacing } = theme.app;

  if (!can('team.manage') || !shop) {
    return (
      <Screen title={t('team.inviteTitle')} stack>
        <Notice message={t('team.forbidden')} />
      </Screen>
    );
  }

  async function create() {
    if (!shop) return;
    const parsed = inviteSchema.safeParse(values);
    setErrors(parsed.success ? {} : firstErrorPerField(parsed.error));
    if (!parsed.success) return;
    setIsSaving(true);
    setFormError(null);
    try {
      // La personne qui invite reste active : l'appareil ne se verrouille pas pendant la saisie
      keepCurrentMember();
      setCreated(await inviteNewMember({ shopId: shop.id, ...parsed.data }));
    } catch {
      setFormError(t('team.inviteOffline'));
    } finally {
      setIsSaving(false);
    }
  }

  if (created) {
    const roles = values.roles.map((role) => t(`roles.${role}`)).join(', ');
    return (
      <Screen title={t('team.inviteTitle')} stack>
        <InviteShareCard
          invite={created}
          message={t('team.inviteMessage', { shop: shop.name, roles, link: created.link })}
          onDone={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('team.inviteTitle')} stack>
      <Notice tone="info" message={t('team.inviteIntro')} />
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <RoleChecklist
            roles={values.roles}
            onChange={(roles) => setValues({ ...values, roles })}
            error={errors.roles ?? null}
          />
          <TextField
            label={t('team.nameOptional')}
            value={values.name}
            onChangeText={(name) => setValues({ ...values, name })}
            autoCapitalize="words"
            maxLength={60}
            errorMessage={errors.name ? t(errors.name) : null}
          />
          <HelperText type="info" visible style={{ marginTop: -spacing.md }}>
            {t('team.nameOptionalHelp')}
          </HelperText>
          <TextField
            label={t('team.emailOptional')}
            value={values.email}
            onChangeText={(email) => setValues({ ...values, email })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            errorMessage={errors.email ? t(errors.email) : null}
          />
          <HelperText type="info" visible style={{ marginTop: -spacing.md }}>
            {t('team.emailOptionalHelp')}
          </HelperText>
          {formError ? <Notice message={formError} /> : null}
          <BigButton
            icon="link-variant"
            variant="accent"
            onPress={create}
            loading={isSaving}
            disabled={isSaving}>
            {t('team.createLink')}
          </BigButton>
        </Card.Content>
      </Card>
    </Screen>
  );
}
