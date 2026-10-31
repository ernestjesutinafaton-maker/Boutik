import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Divider,
  HelperText,
  List,
  Portal,
  Switch,
  Text,
} from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { getCountry } from '@/config/countries';
import { useActionContext } from '@/data/use-action-context';
import { CURRENCIES } from '@/domain/money';
import { RETURN_WINDOW_CHOICES } from '@/domain/sale-edit';
import { type ManagedPaymentMethod, useAllPaymentMethods } from '@/sales/payment-methods';
import {
  addPaymentMethod,
  type PaymentMethodKind,
  updatePaymentMethod,
  updateShopSettings,
} from '@/shop/settings-actions';
import {
  parseSettingsInput,
  type SettingsErrors,
  type SettingsInput,
  settingsToInput,
} from '@/shop/settings-values';
import { ResetDataCard } from '@/shop/reset-data-card';
import { type ShopSettings, useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Paramètres de la boutique : coordonnées, factures, ventes, péremption, modes de paiement. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const settings = useShopSettings();

  if (!can('settings.manage')) {
    return (
      <Screen title={t('settings.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!settings) {
    return (
      <Screen title={t('settings.title')} stack>
        {null}
      </Screen>
    );
  }
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: ShopSettings }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const [values, setValues] = useState<SettingsInput>(() => settingsToInput(settings));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const country = getCountry(settings.countryCode);
  const { spacing } = theme.app;
  const field = (key: keyof SettingsInput) => (errors[key] ? t(errors[key]) : null);

  async function handleSave() {
    if (!context) return;
    const result = parseSettingsInput(values, country.dialCode);
    if (!result.success) {
      setErrors(result.errors);
      setMessage({ text: t('productForm.fixErrors'), tone: 'error' });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      await updateShopSettings(db, context, settings, result.data);
      setMessage({ text: t('settings.saved'), tone: 'info' });
    } catch (error) {
      console.warn('Paramètres impossibles à enregistrer :', error);
      setMessage({ text: t('errors.unknown'), tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('settings.title')} stack>
      <Card mode="outlined">
        <Card.Title title={t('settings.shop')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <TextField
            label={t('createShop.shopName')}
            value={values.name}
            onChangeText={(name) => setValues({ ...values, name })}
            errorMessage={field('name')}
          />
          <TextField
            label={t('settings.phone')}
            value={values.phone}
            onChangeText={(phone) => setValues({ ...values, phone })}
            keyboardType="phone-pad"
            errorMessage={field('phone')}
          />
          <TextField
            label={t('settings.address')}
            value={values.address}
            onChangeText={(address) => setValues({ ...values, address })}
          />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('settings.countryCurrency', {
              country: country.name,
              currency: CURRENCIES[settings.currencyCode].name,
            })}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('settings.invoices')} titleVariant="titleLarge" />
        <Card.Content>
          <TextField
            label={t('settings.invoiceFooter')}
            placeholder={t('settings.invoiceFooterPlaceholder')}
            value={values.invoiceFooter}
            onChangeText={(invoiceFooter) => setValues({ ...values, invoiceFooter })}
            multiline
            errorMessage={field('invoiceFooter')}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('settings.sales')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <View>
            <TextField
              label={t('settings.sellerMaxDiscount')}
              value={values.sellerMaxDiscount}
              onChangeText={(sellerMaxDiscount) => setValues({ ...values, sellerMaxDiscount })}
              keyboardType="number-pad"
              errorMessage={field('sellerMaxDiscount')}
            />
            <HelperText type="info" visible>
              {t('settings.sellerMaxDiscountHelp')}
            </HelperText>
          </View>
          {/* Le délai pendant lequel l'équipe peut modifier une vente (ensuite : archivée) */}
          <View style={{ gap: spacing.sm }}>
            <Text variant="titleMedium">{t('settings.returnWindow')}</Text>
            <View style={[styles.wrap, { gap: spacing.sm }]}>
              {RETURN_WINDOW_CHOICES.map((hours) => (
                <Chip
                  key={hours}
                  selected={values.returnWindowHours === hours}
                  onPress={() => setValues({ ...values, returnWindowHours: hours })}>
                  {t(`settings.returnWindows.h${hours}`)}
                </Chip>
              ))}
            </View>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('settings.returnWindowHelp')}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('settings.expiry')} titleVariant="titleLarge" />
        <Card.Content style={[styles.row, { gap: spacing.sm }]}>
          <View style={styles.fill}>
            <TextField
              label={t('settings.expiryFirst')}
              value={values.expiryFirst}
              onChangeText={(expiryFirst) => setValues({ ...values, expiryFirst })}
              keyboardType="number-pad"
              errorMessage={field('expiryFirst')}
            />
          </View>
          <View style={styles.fill}>
            <TextField
              label={t('settings.expirySecond')}
              value={values.expirySecond}
              onChangeText={(expirySecond) => setValues({ ...values, expirySecond })}
              keyboardType="number-pad"
              errorMessage={field('expirySecond')}
            />
          </View>
        </Card.Content>
      </Card>

      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <BigButton icon="content-save" onPress={handleSave} loading={isSaving} disabled={isSaving}>
        {t('common.save')}
      </BigButton>

      <PaymentMethodsCard />

      <ResetDataCard />
    </Screen>
  );
}

const KINDS: PaymentMethodKind[] = ['cash', 'mobile_money', 'card', 'other'];

/** Les modes de paiement : ajouter, renommer, activer ou désactiver. */
function PaymentMethodsCard() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const methods = useAllPaymentMethods();
  const [editing, setEditing] = useState<ManagedPaymentMethod | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<PaymentMethodKind>('mobile_money');

  function open(method: ManagedPaymentMethod | 'new') {
    setEditing(method);
    setLabel(method === 'new' ? '' : method.label);
    setKind(method === 'new' ? 'mobile_money' : method.kind);
  }

  async function save() {
    const name = label.trim().slice(0, 40);
    if (!context || !name || !editing) return;
    if (editing === 'new') {
      await addPaymentMethod(db, context, { label: name, kind });
    } else {
      await updatePaymentMethod(db, context, editing, { label: name, active: editing.active });
    }
    setEditing(null);
  }

  return (
    <Card mode="outlined">
      <Card.Title title={t('settings.paymentMethods')} titleVariant="titleLarge" />
      {methods.map((method, index) => (
        <View key={method.id}>
          {index > 0 ? <Divider /> : null}
          <List.Item
            title={method.label}
            titleStyle={{ fontWeight: '700', opacity: method.active ? 1 : 0.5 }}
            description={t(`settings.kinds.${method.kind}`)}
            onPress={() => open(method)}
            right={() => (
              <Switch
                value={method.active}
                onValueChange={(active) => {
                  if (context) {
                    void updatePaymentMethod(db, context, method, { label: method.label, active });
                  }
                }}
              />
            )}
          />
        </View>
      ))}
      <Card.Content>
        <Button icon="plus" mode="outlined" onPress={() => open('new')}>
          {t('settings.addMethod')}
        </Button>
        <HelperText type="info" visible>
          {t('settings.methodsHelp')}
        </HelperText>
      </Card.Content>

      <Portal>
        <Dialog visible={editing !== null} onDismiss={() => setEditing(null)}>
          <Dialog.Title>
            {editing === 'new' ? t('settings.addMethod') : t('settings.renameMethod')}
          </Dialog.Title>
          <Dialog.Content style={{ gap: theme.app.spacing.md }}>
            <TextField
              label={t('settings.methodName')}
              value={label}
              onChangeText={setLabel}
              autoFocus
            />
            {editing === 'new' ? (
              <View style={[styles.wrap, { gap: theme.app.spacing.sm }]}>
                {KINDS.map((candidate) => (
                  <Chip
                    key={candidate}
                    selected={candidate === kind}
                    onPress={() => setKind(candidate)}>
                    {t(`settings.kinds.${candidate}`)}
                  </Chip>
                ))}
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button onPress={save} disabled={!label.trim()}>
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fill: {
    flex: 1,
  },
});
