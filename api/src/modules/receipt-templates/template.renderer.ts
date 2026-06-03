/**
 * Minimal mustache-style template renderer for receipts. Supports
 * dotted paths like {{student.name}} or {{payment.amountInWords}} and
 * silently leaves unknown keys empty. No expressions, no loops — just
 * key lookup — so non-technical admins can edit templates safely.
 */

export type TemplateContext = Record<string, unknown>;

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

function get(obj: unknown, path: string): unknown {
  if (!obj) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render `template` against `ctx`. Values from the context are
 * HTML-escaped — placeholders are for text, not for nested HTML. If
 * you need HTML, mark the value as already-safe by passing it as an
 * object `{ raw: '<b>x</b>' }`.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  return (template || '').replace(TOKEN_RE, (_, path: string) => {
    const v = get(ctx, path);
    if (v === undefined || v === null) return '';
    if (typeof v === 'object' && v !== null && 'raw' in (v as any)) {
      return String((v as { raw: unknown }).raw ?? '');
    }
    return htmlEscape(String(v));
  });
}

// ─── Shared formatting helpers exposed via the context ─────────────

export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export function numberToINRWords(amount: number): string {
  if (!Number.isFinite(amount)) return 'Zero';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const inWords = numberWords(rupees);
  const rupeesStr = `${inWords} Rupees`;
  const paiseStr = paise > 0 ? ` and ${numberWords(paise)} Paise` : '';
  return `${rupeesStr}${paiseStr} Only`;
}

function numberWords(n: number): string {
  if (n === 0) return 'Zero';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  const twoDigits = (x: number): string => {
    if (x < 20) return a[x];
    return `${b[Math.floor(x / 10)]}${x % 10 ? ' ' + a[x % 10] : ''}`;
  };
  const threeDigits = (x: number): string => {
    const hundred = Math.floor(x / 100);
    const rest = x % 100;
    return `${hundred ? a[hundred] + ' Hundred' + (rest ? ' ' : '') : ''}${
      rest ? twoDigits(rest) : ''
    }`;
  };
  // Indian numbering: crore, lakh, thousand, hundred.
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}
