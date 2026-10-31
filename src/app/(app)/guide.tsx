import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, Divider, List, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { GUIDE, type GuideSection } from '@/guide/guide-content';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Le guide des boutons : chaque écran, et ce que fait chacun de ses boutons. */
export default function GuideScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [openId, setOpenId] = useState<string | null>(GUIDE[0].id);

  return (
    <Screen title={t('guide.title')} stack>
      <Notice tone="info" message={t('guide.help')} />
      <View style={{ gap: theme.app.spacing.sm }}>
        {GUIDE.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isOpen={openId === section.id}
            onToggle={() => setOpenId(openId === section.id ? null : section.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

function SectionCard({
  section,
  isOpen,
  onToggle,
}: {
  section: GuideSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { can } = useActiveMember();
  const allowed = !section.permission || can(section.permission);

  return (
    <Card mode="outlined">
      <List.Accordion
        title={section.title}
        titleStyle={{ fontWeight: '700' }}
        description={allowed ? undefined : t('guide.notForYou')}
        left={(props) => <List.Icon {...props} icon={section.icon} />}
        expanded={isOpen}
        onPress={onToggle}>
        <Card.Content style={{ gap: theme.app.spacing.sm }}>
          <Text variant="bodyLarge">{section.intro}</Text>
        </Card.Content>
        {section.buttons.map((button, index) => (
          <View key={button.label}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={button.label}
              titleStyle={{ fontWeight: '700' }}
              titleNumberOfLines={2}
              description={button.text}
              descriptionNumberOfLines={6}
              left={(props) => <List.Icon {...props} icon={button.icon} />}
            />
          </View>
        ))}
        {section.href && allowed ? (
          <Card.Content style={{ paddingBottom: theme.app.spacing.md }}>
            <BigButton
              icon="arrow-right"
              variant="outline"
              onPress={() => section.href && router.push(section.href)}>
              {t('guide.open')}
            </BigButton>
          </Card.Content>
        ) : null}
      </List.Accordion>
    </Card>
  );
}
