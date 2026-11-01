import { formatMoment } from '@/domain/dates';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import type { ReportData } from '@/domain/report';
import { escapeHtml } from '@/invoices/invoice-html';
import { palette } from '@/theme/tokens';

/** Les noms des catégories de dépenses, pour l'affichage. */
export const EXPENSE_LABELS: Record<string, string> = {
  transport: 'Livraison et transport',
  fuel: 'Carburant',
  supplies: 'Fournitures',
  utilities: 'Électricité, eau, internet, crédit téléphone',
  rent: 'Loyer',
  salary: 'Salaire ou avance',
  repairs: 'Réparations',
  other: 'Autre',
};

/**
 * La fiche de rapport en HTML (pour le PDF ou l'impression A4).
 * Les bénéfices n'y figurent que si la personne a le droit de les voir.
 */
export function reportHtml(input: {
  report: ReportData;
  title: string;
  shopName: string;
  currency: CurrencyCode;
  showProfit: boolean;
  /** Achats, valeur du stock et bénéfices : seulement si la fiche a les coûts et la personne le droit */
  showCosts: boolean;
}): string {
  const { report, currency } = input;
  const money = (amount: number) => escapeHtml(formatMoney(amount, currency));
  const text = (value: string) => escapeHtml(value);
  const row = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${value}</td></tr>`;
  const section = (title: string, rows: string[]) =>
    rows.length ? `<h2>${title}</h2><table>${rows.join('')}</table>` : '';

  const profit =
    input.showProfit && input.showCosts
      ? section('Bénéfice', [
          row('Chiffre d’affaires', money(report.sales.revenue)),
          row('Coût d’achat des marchandises vendues', `− ${money(report.costOfGoods)}`),
          row('Bénéfice brut', money(report.grossProfit), 'bold'),
          row('Dépenses', `− ${money(report.expenses.total)}`),
          row('Pertes (casse, périmés, vols)', `− ${money(report.losses)}`),
          row('Écarts d’inventaire', money(report.adjustments)),
          row('Bénéfice net', money(report.netProfit), 'grand'),
        ])
      : '';

  const closing = report.closing
    ? section('Caisse : attendu et compté', [
        row('Fond de caisse', money(report.closing.openingFloat)),
        ...report.closing.methods.map((method) =>
          row(
            text(method.label),
            `attendu ${money(method.expected)} · compté ${money(method.counted)} · écart ${money(method.difference)}`
          )
        ),
        row('Écart total', money(report.closing.totalDifference), 'bold'),
      ])
    : '';

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${text(input.title)}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; margin: 16px 0 4px; color: ${palette.light.primary}; border-bottom: 2px solid ${palette.light.primary}; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 2px; border-bottom: 1px solid #E5E7EB; }
  .num { text-align: right; white-space: nowrap; }
  .bold td { font-weight: bold; }
  .grand td { font-weight: bold; font-size: 15px; }
  .muted { color: #4B5563; }
</style></head>
<body>
  <h1>${text(input.shopName)} — ${text(input.title)}</h1>
  <div class="muted">Du ${text(formatMoment(report.periodStart))} au ${text(formatMoment(report.periodEnd))}</div>
  ${section('Ventes', [
    row('Nombre de ventes', String(report.sales.count)),
    row('Ventes annulées', String(report.sales.cancelledCount)),
    row('Total des ventes', money(report.sales.total)),
    row('Remises accordées', money(report.sales.discounts)),
    row('Retours', `− ${money(report.sales.returns)}`),
    row('Chiffre d’affaires', money(report.sales.revenue), 'bold'),
  ])}
  ${closing}
  ${section('Argent encaissé, par mode de paiement', [
    ...report.payments.byMethod.map((method) => row(text(method.label), money(method.amount))),
    row('Total', money(report.payments.total), 'bold'),
  ])}
  ${section('Crédit', [
    row('Crédits accordés', money(report.credit.given)),
    row('Crédits remboursés', money(report.credit.repaid)),
    row('Dettes anciennes ajoutées', money(report.credit.oldDebts)),
    row('Dettes effacées', money(report.credit.writtenOff)),
  ])}
  ${section('Dépenses et sorties de caisse', [
    ...Object.entries(report.expenses.byCategory).map(([category, amount]) =>
      row(text(EXPENSE_LABELS[category] ?? category), money(amount))
    ),
    row('Total des dépenses', money(report.expenses.total), 'bold'),
    ...(input.showCosts
      ? [row('Achats de marchandise payés par la caisse', money(report.cash.stockPurchases))]
      : []),
    row('Retraits du propriétaire', money(report.cash.withdrawals)),
    row('Argent ajouté dans la caisse', money(report.cash.deposits)),
  ])}
  ${profit}
  ${section(
    'Stock',
    input.showCosts
      ? [
          row('Marchandise reçue (prix d’achat)', money(report.stock.receivedValue)),
          row('Pertes', money(report.losses)),
          row('Valeur du stock à la fin', money(report.stock.valueAtEnd), 'bold'),
        ]
      : []
  )}
  ${section('Écarts de caisse', [
    row(
      `Caisses clôturées : ${report.cashDifferences.sessions}`,
      money(report.cashDifferences.total)
    ),
  ])}
  ${section(
    'Produits les plus vendus',
    report.topProducts.map((product) =>
      row(
        `${text(product.name)} (${text(formatQuantity(product.quantity))} ${text(product.baseUnit)})`,
        money(product.revenue)
      )
    )
  )}
  ${section('Clients qui doivent de l’argent', [
    ...report.debtors.map((debtor) =>
      row(`${text(debtor.name)} (depuis ${debtor.ageDays} j)`, money(debtor.balance))
    ),
    row('Total dû', money(report.totalDebt), 'bold'),
  ])}
</body></html>`;
}
