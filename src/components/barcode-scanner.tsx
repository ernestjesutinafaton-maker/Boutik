import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

import { BigButton } from './big-button';
import { TextField } from './text-field';

type BarcodeScannerProps = {
  visible: boolean;
  onClose: () => void;
  /** Appelé avec le code lu (ou tapé à la main) */
  onScanned: (code: string) => void;
};

/**
 * Lecture d'un code-barres avec l'appareil photo (téléphone, tablette, et navigateur
 * qui le permet). On peut aussi taper le code à la main.
 * Sur ordinateur, un lecteur de codes-barres USB marche sans cet écran : il « tape »
 * le code directement dans le champ de recherche.
 */
export function BarcodeScanner({ visible, onClose, onScanned }: BarcodeScannerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  // La caméra lit le même code plusieurs fois par seconde : on ne garde que la première lecture
  const handled = useRef(false);

  function finish(code: string) {
    if (handled.current || !code.trim()) {
      return;
    }
    handled.current = true;
    setManualCode('');
    onScanned(code.trim());
  }

  function handleShow() {
    handled.current = false;
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleShow}
      statusBarTranslucent>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + theme.app.spacing.md,
            paddingBottom: insets.bottom + theme.app.spacing.md,
            paddingHorizontal: theme.app.spacing.md,
            gap: theme.app.spacing.md,
          },
        ]}>
        <Text variant="titleLarge" style={styles.bold}>
          {t('scanner.title')}
        </Text>

        <View
          style={[
            styles.camera,
            { borderRadius: theme.app.radius.lg, backgroundColor: theme.colors.surfaceVariant },
          ]}>
          {permission?.granted && visible ? (
            <CameraView
              style={styles.fill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={(result) => finish(result.data)}
            />
          ) : (
            <View
              style={[styles.center, { gap: theme.app.spacing.md, padding: theme.app.spacing.md }]}>
              <Text variant="bodyLarge" style={styles.centered}>
                {t('scanner.permission')}
              </Text>
              <BigButton icon="camera" onPress={() => void requestPermission()}>
                {t('scanner.allow')}
              </BigButton>
            </View>
          )}
        </View>

        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('scanner.help')}
        </Text>
        <TextField
          label={t('scanner.manual')}
          value={manualCode}
          onChangeText={setManualCode}
          keyboardType="number-pad"
          onSubmitEditing={() => finish(manualCode)}
          returnKeyType="done"
        />
        <View style={[styles.row, { gap: theme.app.spacing.sm }]}>
          <BigButton variant="outline" style={styles.fill} onPress={onClose}>
            {t('common.cancel')}
          </BigButton>
          <BigButton
            style={styles.fill}
            disabled={!manualCode.trim()}
            onPress={() => finish(manualCode)}>
            {t('common.confirm')}
          </BigButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  camera: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 240,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
  },
});
