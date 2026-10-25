import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet } from 'react-native';
import { Icon, List, Modal, Portal, Text, TouchableRipple } from 'react-native-paper';

import { COUNTRIES, getCountry } from '@/config/countries';
import { useAppTheme } from '@/theme/paper-theme';

type CountryPickerProps = {
  value: string;
  onChange: (countryCode: string) => void;
};

/** Le Bénin d'abord (pays de lancement), puis les autres par ordre alphabétique. */
const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) =>
  a.code === 'BJ' ? -1 : b.code === 'BJ' ? 1 : a.name.localeCompare(b.name, 'fr')
);

/** Choix du pays : un champ qui ouvre une liste à faire défiler. */
export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { colors, spacing, radius, touch } = theme.app;
  const selected = getCountry(value);

  return (
    <>
      <TouchableRipple
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('createShop.chooseCountry')}
        style={[
          styles.field,
          {
            minHeight: touch.minHeight,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          },
        ]}>
        <>
          <Text variant="bodyLarge" style={styles.fieldText}>
            {t('createShop.country')} : {selected.name} ({selected.dialCode})
          </Text>
          <Icon source="menu-down" size={24} color={colors.textSecondary} />
        </>
      </TouchableRipple>

      <Portal>
        <Modal
          visible={isOpen}
          onDismiss={() => setIsOpen(false)}
          contentContainerStyle={[
            styles.modal,
            { backgroundColor: colors.surface, borderRadius: radius.lg, margin: spacing.lg },
          ]}>
          <Text variant="titleLarge" style={[styles.modalTitle, { padding: spacing.md }]}>
            {t('createShop.chooseCountry')}
          </Text>
          <FlatList
            data={SORTED_COUNTRIES}
            keyExtractor={(country) => country.code}
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                description={item.dialCode}
                onPress={() => {
                  onChange(item.code);
                  setIsOpen(false);
                }}
                right={(props) =>
                  item.code === value ? <List.Icon {...props} icon="check" /> : null
                }
              />
            )}
          />
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  fieldText: {
    flex: 1,
  },
  modal: {
    maxHeight: '80%',
    maxWidth: 480,
    width: '90%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontWeight: '700',
  },
});
