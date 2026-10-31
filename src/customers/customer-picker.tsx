import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { Button, Divider, IconButton, List, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { getCountry } from '@/config/countries';
import { useActionContext } from '@/data/use-action-context';
import { normalizeText } from '@/domain/catalog';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { createCustomer } from './customer-actions';
import { type Customer, useCustomers } from './customer-data';
import { emptyCustomerInput, parseCustomerInput } from './customer-form-values';

type CustomerPickerProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (customerId: string) => void;
};

/** Filtre les clients par nom ou par téléphone. */
export function searchCustomers(customers: readonly Customer[], query: string): Customer[] {
  const text = normalizeText(query);
  const digits = query.replace(/\D/g, '');
  if (!text) {
    return [...customers];
  }
  return customers.filter(
    (customer) =>
      normalizeText(customer.name).includes(text) ||
      (digits.length >= 3 && (customer.phone ?? '').replace(/\D/g, '').includes(digits))
  );
}

/** Choisir un client à la caisse, ou en créer un en deux secondes (nom + téléphone). */
export function CustomerPicker({ visible, onClose, onPick }: CustomerPickerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const { customers } = useCustomers();
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const results = searchCustomers(customers, query);

  function pick(customerId: string) {
    setQuery('');
    setPhone('');
    setIsCreating(false);
    onPick(customerId);
  }

  async function handleCreate() {
    if (!shop || !context) {
      return;
    }
    const result = parseCustomerInput(
      { ...emptyCustomerInput(), name: query, phone },
      shop.currencyCode,
      getCountry(shop.countryCode).dialCode
    );
    if (!result.success) {
      const key = result.errors.name ?? result.errors.phone;
      setError(key ? t(key) : null);
      return;
    }
    setError(null);
    pick(await createCustomer(db, context, result.data));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + theme.app.spacing.sm,
            paddingBottom: insets.bottom,
            paddingHorizontal: theme.app.spacing.md,
            gap: theme.app.spacing.sm,
          },
        ]}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={[styles.fill, styles.bold]}>
            {t('customerPicker.title')}
          </Text>
          <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
        </View>
        <TextField
          label={t('customerPicker.search')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          left={<TextInput.Icon icon="magnify" />}
        />

        {can('customers.edit') ? (
          isCreating ? (
            <View style={{ gap: theme.app.spacing.sm }}>
              <Text variant="bodyMedium">{t('customerPicker.newHelp')}</Text>
              <TextField
                label={t('customers.phone')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              {error ? <Notice message={error} /> : null}
              <View style={[styles.header, { gap: theme.app.spacing.sm }]}>
                <Button mode="outlined" style={styles.fill} onPress={() => setIsCreating(false)}>
                  {t('common.cancel')}
                </Button>
                <Button mode="contained" style={styles.fill} onPress={handleCreate}>
                  {t('customerPicker.create')}
                </Button>
              </View>
            </View>
          ) : (
            <Button mode="outlined" icon="account-plus" onPress={() => setIsCreating(true)}>
              {query.trim()
                ? t('customerPicker.createNamed', { name: query.trim() })
                : t('customerPicker.new')}
            </Button>
          )
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(customer) => customer.id}
          keyboardShouldPersistTaps="handled"
          // Dessiner peu de lignes à la fois : rapide même sur les vieux téléphones
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text variant="bodyLarge" style={[styles.centered, { padding: theme.app.spacing.lg }]}>
              {t('customerPicker.empty')}
            </Text>
          }
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              titleStyle={styles.bold}
              description={item.phone ?? undefined}
              onPress={() => pick(item.id)}
              left={(props) => <List.Icon {...props} icon="account" />}
              right={() =>
                item.balance > 0 && shop ? (
                  <View style={styles.center}>
                    <MoneyText
                      amount={item.balance}
                      currency={shop.currencyCode}
                      tone="danger"
                      style={{ fontSize: theme.app.fontSize.body }}
                    />
                  </View>
                ) : null
              }
            />
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  centered: {
    textAlign: 'center',
  },
  center: {
    justifyContent: 'center',
  },
});
