import { usePowerSync, useQuery } from '@powersync/react';
import { useEffect, useState } from 'react';

import { dailyTotals, type SleepingProduct, sleepingProducts } from '@/domain/dashboard';
import { addDays, dayRange, today } from '@/domain/dates';
import { buildReport, type ReportData } from '@/domain/report';
import { loadReportInput } from '@/reports/report-input';
import { useShop } from '@/shop/shop-provider';
import type { Reader } from '@/stock/stock-data';

/** Les périodes du tableau de bord. */
export type DashboardPeriod = 'today' | 'week' | 'month';

export type DashboardData = {
  reports: Record<DashboardPeriod, ReportData>;
  /** Ventes des 14 derniers jours */
  series: { day: string; total: number; count: number }[];
  sleeping: SleepingProduct[];
};

/** Début de chaque période : aujourd'hui, 7 derniers jours, 30 derniers jours. */
function periodStart(period: DashboardPeriod, day: string): string {
  const offset = period === 'today' ? 0 : period === 'week' ? 6 : 29;
  return dayRange(addDays(day, -offset)).start;
}

/** Calcule tous les chiffres du tableau de bord (lecture de la base locale). */
export async function loadDashboard(
  reader: Reader,
  shopId: string,
  day: string,
  end: string
): Promise<DashboardData> {
  const periods: DashboardPeriod[] = ['today', 'week', 'month'];
  const reports = {} as Record<DashboardPeriod, ReportData>;
  for (const period of periods) {
    reports[period] = buildReport(
      await loadReportInput(reader, shopId, periodStart(period, day), end, day)
    );
  }
  const sales = await reader.getAll<{
    occurred_at: string;
    total: number;
    status: 'completed' | 'cancelled';
  }>('SELECT occurred_at, total, status FROM sales WHERE shop_id = ? AND occurred_at >= ?', [
    shopId,
    dayRange(addDays(day, -13)).start,
  ]);
  const products = await reader.getAll<{
    id: string;
    name: string;
    stock: number;
    base_unit: string;
    last_sale_at: string | null;
    in_stock_since: string | null;
  }>(
    `SELECT p.id, p.name, p.base_unit,
            COALESCE((SELECT MIN(m.occurred_at) FROM stock_movements m
                       WHERE m.product_id = p.id AND m.type = 'receipt'), p.created_at) AS in_stock_since,
              COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.product_id = p.id), 0) AS stock,
              (SELECT MAX(m.occurred_at) FROM stock_movements m
                WHERE m.product_id = p.id AND m.type = 'sale') AS last_sale_at
         FROM products p
        WHERE p.shop_id = ? AND p.archived_at IS NULL`,
    [shopId]
  );
  return {
    reports,
    series: dailyTotals(
      sales.map((sale) => ({
        occurredAt: sale.occurred_at,
        total: sale.total,
        status: sale.status,
      })),
      day,
      14
    ),
    sleeping: sleepingProducts(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        baseUnit: product.base_unit,
        lastSaleAt: product.last_sale_at,
        inStockSince: product.in_stock_since,
      })),
      day
    ),
  };
}

/**
 * Les chiffres du tableau de bord, recalculés dès que la base change
 * (vente, remboursement, réception… sur cet appareil ou reçus d'un autre).
 */
export function useDashboard(): { data: DashboardData | null; isLoading: boolean } {
  const db = usePowerSync();
  const { shop } = useShop();
  const shopId = shop?.id ?? '';
  // « Empreinte » de la base : elle change à chaque opération, ce qui relance le calcul
  const { data: fingerprint } = useQuery<Record<string, number>>(
    `SELECT (SELECT COUNT(*) FROM sales WHERE shop_id = ?1) AS sales,
            (SELECT COUNT(*) FROM sales WHERE shop_id = ?1 AND status = 'cancelled') AS cancelled,
            (SELECT COUNT(*) FROM payments WHERE shop_id = ?1) AS payments,
            (SELECT COUNT(*) FROM stock_movements WHERE shop_id = ?1) AS movements,
            (SELECT COUNT(*) FROM customer_ledger WHERE shop_id = ?1) AS ledger,
            (SELECT COUNT(*) FROM cash_movements WHERE shop_id = ?1) AS cash,
            (SELECT COUNT(*) FROM cash_sessions WHERE shop_id = ?1 AND status = 'closed') AS closed`,
    [shopId]
  );
  const key = JSON.stringify(fingerprint[0] ?? {});
  const [state, setState] = useState<{ key: string; data: DashboardData } | null>(null);

  useEffect(() => {
    if (!shopId) {
      return;
    }
    let cancelled = false;
    loadDashboard(db, shopId, today(), new Date().toISOString())
      .then((data) => {
        if (!cancelled) {
          setState({ key, data });
        }
      })
      .catch((error: unknown) => console.warn('Tableau de bord : calcul impossible :', error));
    return () => {
      cancelled = true;
    };
  }, [db, shopId, key]);

  return { data: state?.data ?? null, isLoading: state?.key !== key };
}
