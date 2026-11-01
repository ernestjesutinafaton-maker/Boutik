import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { formatDay, toDay } from '@/domain/dates';
import { useShop } from '@/shop/shop-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { InviteShareCard } from './invite-share-card';
import { type CreatedInvite, inviteExistingMember, revokeInvite } from './invitations';
import type { TeamMember } from './team-data';
import { usePendingInvites } from './use-pending-invites';

type Feedback = { tone: 'info' | 'error'; text: string };

/**
 * Le compte personnel d'une personne de l'équipe : elle l'a déjà, une invitation est en cours
 * (renvoyer ou annuler le lien), ou on lui crée un lien pour qu'elle ait son propre compte.
 */
export function MemberAccountCard({ member }: { member: TeamMember }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const { pending, refresh } = usePendingInvites(shop?.id ?? null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const invitedUntil = pending[member.id] ?? null;
  const { spacing } = theme.app;

  if (member.userId) {
    return (
      <Card mode="outlined">
        <Card.Title title={t('team.accountCard.title')} titleVariant="titleLarge" />
        <Card.Content>
          <Text variant="bodyLarge">{t('team.accountCard.hasAccount')}</Text>
        </Card.Content>
      </Card>
    );
  }

  if (created && shop) {
    const roles = member.roles.map((role) => t(`roles.${role}`)).join(', ');
    return (
      <InviteShareCard
        invite={created}
        message={t('team.inviteMessage', { shop: shop.name, roles, link: created.link })}
        onDone={() => {
          setCreated(null);
          refresh();
        }}
      />
    );
  }

  async function createLink() {
    setIsBusy(true);
    setFeedback(null);
    try {
      setCreated(await inviteExistingMember(member.id, ''));
    } catch {
      setFeedback({ tone: 'error', text: t('team.inviteOffline') });
    } finally {
      setIsBusy(false);
    }
  }

  async function revoke() {
    setIsBusy(true);
    try {
      await revokeInvite(member.id);
      setFeedback({ tone: 'info', text: t('team.accountCard.revoked') });
      refresh();
    } catch {
      setFeedback({ tone: 'error', text: t('team.inviteOffline') });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Card mode="outlined">
      <Card.Title title={t('team.accountCard.title')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: spacing.md }}>
        <Text variant="bodyLarge">
          {invitedUntil
            ? t('team.accountCard.invited', { date: formatDay(toDay(invitedUntil)) })
            : t('team.accountCard.none')}
        </Text>
        {feedback ? <Notice tone={feedback.tone} message={feedback.text} /> : null}
        <BigButton
          icon="link-variant"
          variant={invitedUntil ? 'outline' : 'accent'}
          onPress={createLink}
          loading={isBusy}
          disabled={isBusy}>
          {invitedUntil ? t('team.accountCard.newLink') : t('team.accountCard.createLink')}
        </BigButton>
        {invitedUntil ? (
          <Button
            icon="link-variant-off"
            textColor={theme.app.colors.danger}
            onPress={revoke}
            disabled={isBusy}>
            {t('team.accountCard.revoke')}
          </Button>
        ) : null}
      </Card.Content>
    </Card>
  );
}
