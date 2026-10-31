import type { ExportTable } from '@/export/datasets';
import { escapeHtml } from '@/invoices/invoice-html';

/**
 * Un tableau d'export (ventes, stock, inventaire…) en page HTML, pour le PDF ou l'impression.
 * Format paysage : les tableaux ont souvent beaucoup de colonnes.
 * Les colonnes de nombres sont alignées à droite.
 */
export function tableHtml(input: {
  table: ExportTable;
  title: string;
  shopName: string;
  subtitle: string;
}): string {
  const { headers, rows } = input.table;
  const isNumber = (cell: unknown) => typeof cell === 'string' && /^-?\d+(,\d+)?$/.test(cell);
  // Une colonne est « de nombres » si toutes ses cases remplies sont des nombres
  const numeric = headers.map((_, index) => {
    const filled = rows.map((row) => row[index]).filter((cell) => cell !== null && cell !== '');
    return filled.length > 0 && filled.every(isNumber);
  });
  const cell = (value: unknown, index: number) =>
    `<td${numeric[index] ? ' class="num"' : ''}>${escapeHtml(value === null ? '' : String(value))}</td>`;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111827; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #4B5563; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #ECFDF5; color: #065F46; border-bottom: 2px solid #059669; }
  th, td { padding: 3px 4px; }
  td { border-bottom: 1px solid #E5E7EB; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
</style></head>
<body>
  <h1>${escapeHtml(input.shopName)} — ${escapeHtml(input.title)}</h1>
  <div class="muted">${escapeHtml(input.subtitle)} · ${rows.length} ligne${rows.length > 1 ? 's' : ''}</div>
  <table>
    <thead><tr>${headers.map((header, index) => `<th${numeric[index] ? ' class="num"' : ''}>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')}</tbody>
  </table>
</body></html>`;
}
