import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, List } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { formatDay, toDay } from '@/domain/dates';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { type TeamMember, useTeamMembers } from '@/team/team-data';
import { usePendingInvites } from '@/team/use-pending-invites';

/**
 * L'équipe de la boutique : qui fait quoi, qui a son propre compte, qui a son code PIN.
 * Deux façons d'ajouter quelqu'un : un lien d'invitation (compte personnel, sur son téléphone)
 * ou un profil à code PIN (seulement sur l'appareil de la boutique). Réservé au propriétaire.
 */
export default function TeamScreen() {
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const { shop } = useShop();
  const { members } = useTeamMembers();
  const { pending } = usePendingInvites(shop?.id ?? null);
  const [showFormer, setShowFormer] = useState(false);
  const formerCount = members.filter((member) => !member.active).length;
  const shown = showFormer ? members : members.filter((member) => member.active);

  if (!can('team.manage')) {
    return (
      <Screen title={t('team.title')} stack>
        <Notice message={t('team.forbidden')} />
      </Screen>
    );
  }

  const accountMember = members.find((member) => member.id === shop?.memberId);
  // Un profil à code PIN partage l'appareil de la boutique : le propriétaire doit avoir le sien d'abord
  const ownerNeedsPin = accountMember !== undefined && !accountMember.hasPin;

  /** Où en est le compte d'une personne : son compte, une invitation en cours, ou son code PIN. */
  function accountStatus(member: TeamMember): string | null {
    if (member.id === shop?.memberId) return null;
    if (member.userId) return t('team.status.account');
    const invitedUntil = pending[member.id];
    if (invitedUntil) return t('team.status.invited', { date: formatDay(toDay(invitedUntil)) });
    return member.hasPin ? t('team.status.pinOnly') : t('team.status.none');
  }

  return (
    <Screen title={t('team.title')} stack>
      <Card mode="outlined">
        <List.Item
          title={t('team.inviteWithLink')}
          titleStyle={{ fontWeight: '700' }}
          description={t('team.inviteWithLinkHelp')}
          descriptionNumberOfLines={3}
          left={(props) => <List.Icon {...props} icon="link-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/team/invite')}
        />
        <List.Item
          title={t('team.addPinProfile')}
          titleStyle={{ fontWeight: '700' }}
          description={t('team.addPinProfileHelp')}
          descriptionNumberOfLines={3}
          disabled={ownerNeedsPin}
          left={(props) => <List.Icon {...props} icon="dialpad" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/team/new')}
        />
      </Card>
      {ownerNeedsPin ? (
        <>
          <Notice tone="info" message={t('team.ownerPinFirst')} />
          <BigButton
            icon="lock"
            variant="outline"
            onPress={() => router.push(`/team/${accountMember.id}`)}>
            {t('team.setMyPin')}
          </BigButton>
        </>
      ) : null}

      <Card mode="outlined">
        {shown.map((member) => {
          const details = [
            member.roles.map((role) => t(`roles.${role}`)).join(', '),
            accountStatus(member),
            member.active ? null : t('team.inactive'),
          ].filter(Boolean);
          return (
            <List.Item
              key={member.id}
              title={
                member.id === shop?.memberId ? `${member.name} (${t('team.you')})` : member.name
              }
              titleStyle={{ fontWeight: '700', opacity: member.active ? 1 : 0.5 }}
              description={details.join(' · ')}
              descriptionNumberOfLines={2}
              left={(props) => (
                <List.Icon {...props} icon={member.active ? 'account' : 'account-off'} />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(`/team/${member.id}`)}
            />
          );
        })}
      </Card>
      {formerCount > 0 ? (
        <Button icon={showFormer ? 'eye-off' : 'eye'} onPress={() => setShowFormer(!showFormer)}>
          {showFormer ? t('team.hideFormer') : t('team.showFormer', { count: formerCount })}
        </Button>
      ) : null}
    </Screen>
  );
}
