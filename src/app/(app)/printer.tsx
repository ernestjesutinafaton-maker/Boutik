import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Divider, List, SegmentedButtons, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import type { PaperWidth } from '@/printing/escpos';
import {
  isBluetoothPrintingSupported,
  listPrinters,
  type PrinterInfo,
  printerErrorCode,
  printToPrinter,
  requestPrinterPermission,
} from '@/printing/printer';
import { usePrinterSettings } from '@/printing/printer-settings';
import { testTicketBytes } from '@/printing/ticket';
import { useShopSettings } from '@/shop/shop-settings';
import { useAppTheme } from '@/theme/paper-theme';

/** Choisir l'imprimante de tickets Bluetooth (une seule fois), la largeur du papier, et l'essayer. */
export default function PrinterScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const shop = useShopSettings();
  const { settings, save } = usePrinterSettings();
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const width: PaperWidth = settings?.width ?? 58;

  async function search() {
    setMessage(null);
    setIsSearching(true);
    try {
      if (!(await requestPrinterPermission())) {
        setMessage({ text: t('printer.errors.permission_denied'), tone: 'error' });
        return;
      }
      setPrinters(await listPrinters());
    } catch (error) {
      setMessage({ text: t(`printer.errors.${printerErrorCode(error)}`), tone: 'error' });
    } finally {
      setIsSearching(false);
    }
  }

  async function test() {
    if (!settings) return;
    setMessage(null);
    setIsTesting(true);
    try {
      await printToPrinter(
        settings.address,
        testTicketBytes(shop?.name ?? 'Boutik', settings.width)
      );
      setMessage({ text: t('printer.testSent'), tone: 'info' });
    } catch (error) {
      setMessage({ text: t(`printer.errors.${printerErrorCode(error)}`), tone: 'error' });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Screen title={t('printer.title')} stack>
      {!isBluetoothPrintingSupported ? <Notice tone="info" message={t('printer.webHelp')} /> : null}

      <Card mode="outlined">
        <Card.Title title={t('printer.paper')} titleVariant="titleLarge" />
        <Card.Content>
          <SegmentedButtons
            value={String(width)}
            onValueChange={(value) => {
              const newWidth: PaperWidth = value === '80' ? 80 : 58;
              // Sur ordinateur, seule la largeur compte (impression par le système)
              void save(
                settings
                  ? { ...settings, width: newWidth }
                  : isBluetoothPrintingSupported
                    ? null
                    : { address: '', name: '', width: newWidth }
              );
            }}
            buttons={[
              { value: '58', label: '58 mm', disabled: !settings && isBluetoothPrintingSupported },
              { value: '80', label: '80 mm', disabled: !settings && isBluetoothPrintingSupported },
            ]}
          />
        </Card.Content>
      </Card>

      {isBluetoothPrintingSupported ? (
        <>
          <Card mode="outlined">
            <Card.Title title={t('printer.current')} titleVariant="titleLarge" />
            <Card.Content style={{ gap: theme.app.spacing.sm }}>
              <Text variant="bodyLarge">{settings ? settings.name : t('printer.none')}</Text>
              {settings ? (
                <View style={{ gap: theme.app.spacing.sm }}>
                  <BigButton
                    icon="printer-check"
                    onPress={test}
                    loading={isTesting}
                    disabled={isTesting}>
                    {t('printer.test')}
                  </BigButton>
                  <BigButton icon="link-off" variant="outline" onPress={() => save(null)}>
                    {t('printer.forget')}
                  </BigButton>
                </View>
              ) : null}
            </Card.Content>
          </Card>

          <Notice tone="info" message={t('printer.pairHelp')} />
          <BigButton
            icon="bluetooth-connect"
            onPress={search}
            loading={isSearching}
            disabled={isSearching}>
            {t('printer.search')}
          </BigButton>

          {printers ? (
            <Card mode="outlined">
              {printers.length === 0 ? (
                <Card.Content style={{ paddingVertical: theme.app.spacing.md }}>
                  <Text variant="bodyLarge">{t('printer.noneFound')}</Text>
                </Card.Content>
              ) : null}
              {printers.map((printer, index) => (
                <View key={printer.address}>
                  {index > 0 ? <Divider /> : null}
                  <List.Item
                    title={printer.name || printer.address}
                    description={printer.address}
                    left={(props) => <List.Icon {...props} icon="printer-pos" />}
                    right={(props) =>
                      settings?.address === printer.address ? (
                        <List.Icon {...props} icon="check" color={theme.colors.primary} />
                      ) : null
                    }
                    onPress={() =>
                      save({
                        address: printer.address,
                        name: printer.name || printer.address,
                        width,
                      })
                    }
                  />
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {message ? <Notice tone={message.tone} message={message.text} /> : null}
    </Screen>
  );
}
