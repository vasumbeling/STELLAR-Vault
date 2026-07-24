import { type HistoryEntry } from '@/lib/history';

export const CATEGORIES = [
  'Food & Drink',
  'Transport',
  'Bills',
  'Shopping',
  'Transfers',
  'Savings',
  'Income',
  'Other',
] as const;

export type Category = typeof CATEGORIES[number];

/** Categories a budget envelope makes sense for — excludes Income/Transfers,
 *  which aren't "spend" categories, though Savings is included since it's
 *  useful to cap/track vault contributions the same way. */
export const BUDGETABLE_CATEGORIES = CATEGORIES.filter(
  (c) => c !== 'Income' && c !== 'Transfers'
) as Category[];

export const CATEGORY_STYLE: Record<Category, { bg: string; fg: string; bar: string }> = {
  'Food & Drink': { bg: 'bg-[#FFF1E6]', fg: 'text-[#D8641E]', bar: '#FF9F1C' },
  Transport: { bg: 'bg-[#E6F1FF]', fg: 'text-[#2563EB]', bar: '#2563EB' },
  Bills: { bg: 'bg-[#FCE8E8]', fg: 'text-[#DC2626]', bar: '#DC2626' },
  Shopping: { bg: 'bg-[#F3E8FD]', fg: 'text-[#9333EA]', bar: '#9333EA' },
  Transfers: { bg: 'bg-[#E3FCFC]', fg: 'text-[#00A3A3]', bar: '#00A3A3' },
  Savings: { bg: 'bg-[#E6FBF3]', fg: 'text-[#10B981]', bar: '#10B981' },
  Income: { bg: 'bg-[#EAF6DA]', fg: 'text-[#4D7C0F]', bar: '#65A30D' },
  Other: { bg: 'bg-slate-100', fg: 'text-slate-500', bar: '#94A3B8' },
};

export function guessCategory(entry: HistoryEntry): Category {
  const tagMatch = entry.description?.match(/^\[([^\]]+)\]/);
  if (tagMatch) {
    const tagged = tagMatch[1] as Category;
    if ((CATEGORIES as readonly string[]).includes(tagged)) return tagged;
  }

  const text = `${entry.title} ${entry.description}`.toLowerCase();
  if (entry.kind === 'send' || text.includes('transfer')) return 'Transfers';
  if (entry.kind === 'withdraw') return 'Savings';
  if (text.includes('deposit') || text.includes('salary') || text.includes('received')) return 'Income';
  if (text.includes('food') || text.includes('coffee') || text.includes('restaurant')) return 'Food & Drink';
  if (text.includes('grab') || text.includes('transport') || text.includes('fare')) return 'Transport';
  if (text.includes('bill') || text.includes('electric') || text.includes('rent')) return 'Bills';
  if (text.includes('shop') || text.includes('store')) return 'Shopping';
  return 'Other';
}

/** Vault-side movements (savings growth) vs. wallet-side movements (spending/income). */
const VAULT_KINDS = new Set(['deposit', 'withdraw']);
export const isVaultEntry = (entry: HistoryEntry) => VAULT_KINDS.has(entry.kind as string);
export const signedVaultAmount = (entry: HistoryEntry) =>
  entry.kind === 'withdraw' ? -Math.abs(entry.amount) : Math.abs(entry.amount);

export function monthKey(ts: number | string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function lastMonthKeys(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function stripCategoryTag(description: string): string {
  return description.replace(/^\[[^\]]+\]\s*/, '');
}

export function currentMonthKey(): string {
  return monthKey(Date.now());
}