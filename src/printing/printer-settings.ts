import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { PaperWidth } from './escpos';

/** L'imprimante de tickets choisie sur CET appareil (gardée dans l'appareil). */
export type PrinterSettings = { address: string; name: string; width: PaperWidth };

const STORAGE_KEY = 'boutik.printer';

export async function readPrinterSettings(): Promise<PrinterSettings | null> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as PrinterSettings) : null;
  } catch {
    return null;
  }
}

export async function savePrinterSettings(settings: PrinterSettings | null): Promise<void> {
  if (settings) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

/** L'imprimante choisie (null = aucune), et de quoi la changer. */
export function usePrinterSettings(): {
  settings: PrinterSettings | null;
  isLoaded: boolean;
  save: (settings: PrinterSettings | null) => Promise<void>;
} {
  const [state, setState] = useState<{ settings: PrinterSettings | null; isLoaded: boolean }>({
    settings: null,
    isLoaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    readPrinterSettings().then((settings) => {
      if (!cancelled) setState({ settings, isLoaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(settings: PrinterSettings | null) {
    await savePrinterSettings(settings);
    setState({ settings, isLoaded: true });
  }

  return { ...state, save };
}
