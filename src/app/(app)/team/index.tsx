import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, List } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useTeamMembers } from '@/team/team-data';

/** L'équipe de la boutique : qui fait quoi, et qui a son code PIN. Réservé au propriétaire. */
export default function TeamScreen() {
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const { shop } = useShop();
  const { members } = useTeamMembers();

  if (!can('team.manage')) {
    return (
      <Screen title={t('team.title')} stack>
        <Notice message={t('team.forbidden')} />
      </Screen>
    );
  }

  const accountMember = members.find((member) => member.id === shop?.memberId);
  // Dès qu'il y a une équipe, chacun tape son code : le propriétaire doit avoir le sien d'abord
  const ownerNeedsPin = accountMember !== undefined && !accountMember.hasPin;

  return (
    <Screen title={t('team.title')} stack>
      {ownerNeedsPin ? (
        <>
          <Notice tone="info" message={t('team.ownerPinFirst')} />
          <BigButton icon="lock" onPress={() => router.push(`/team/${accountMember.id}`)}>
            {t('team.setMyPin')}
          </BigButton>
        </>
      ) : null}

      <BigButton
        icon="account-plus"
        variant="accent"
        disabled={ownerNeedsPin}
        onPress={() => router.push('/team/new')}>
        {t('team.add')}
      </BigButton>

      <Card mode="outlined">
        {members.map((member) => {
          const details = [
            member.roles.map((role) => t(`roles.${role}`)).join(', '),
            member.hasPin ? t('team.hasPin') : t('team.noPin'),
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
    </Screen>
  );
}
