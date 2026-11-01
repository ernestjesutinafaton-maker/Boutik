import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { formatDay, toDay } from '@/domain/dates';
import { useAppTheme } from '@/theme/paper-theme';

import { whatsappShareLink } from './invite-links';
import { type CreatedInvite, shareText } from './invitations';

type InviteShareCardProps = {
  invite: CreatedInvite;
  /** Le message complet (avec le lien) envoyé au futur membre */
  message: string;
  onDone: () => void;
};

/** Le lien d'invitation est prêt : on le voit en entier, et on l'envoie en un geste. */
export function InviteShareCard({ invite, message, onDone }: InviteShareCardProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<'copied' | 'failed' | null>(null);
  const { spacing, radius } = theme.app;

  async function share() {
    const result = await shareText(message);
    setFeedback(result === 'shared' ? null : result);
  }

  return (
    <Card mode="outlined">
      <Card.Title title={t('team.linkReady')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: spacing.md }}>
        <Text variant="bodyLarge">
          {t('team.linkValidUntil', { date: formatDay(toDay(invite.expiresAt)) })}
        </Text>
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: theme.colors.surfaceVariant,
          }}>
          <Text variant="bodyMedium" selectable style={styles.link}>
            {invite.link}
          </Text>
        </View>
        <BigButton icon="whatsapp" onPress={() => Linking.openURL(whatsappShareLink(message))}>
          {t('team.sendWhatsApp')}
        </BigButton>
        <BigButton icon="share-variant" variant="outline" onPress={share}>
          {t('team.shareLink')}
        </BigButton>
        {feedback ? (
          <Notice
            tone={feedback === 'copied' ? 'info' : 'error'}
            message={feedback === 'copied' ? t('team.linkCopied') : t('team.shareFailed')}
          />
        ) : null}
        <BigButton icon="check" variant="outline" onPress={onDone}>
          {t('team.done')}
        </BigButton>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  link: {
    fontFamily: 'monospace',
  },
});
