'use client';

import React, { useMemo, useState } from 'react';
import { type HistoryEntry } from '@/lib/history';
import { RefreshIcon } from '@/app/icons';

interface MoneyTrackerProps {
  history: HistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Client-side-only categorization for now — no backend field for this yet.
 * Assignments persist for the lifetime of the tab (component state), and
 * a sensible default is guessed from the entry's kind/title so the list
 * isn't just "Uncategorized" on first load.
 */
const CATEGORIES = [
  'Food & Drink',
  'Transport',
  'Bills',
  'Shopping',
  'Transfers',
  'Savings',
  'Income',
  'Other',
] as const;

type Category = typeof CATEGORIES[number];

const CATEGORY_STYLE: Record<Category, { bg: string; fg: string }> = {
  'Food & Drink': { bg: 'bg-[#FFF1E6]', fg: 'text-[#D8641E]' },
  'Transport': { bg: 'bg-[#E6F1FF]', fg: 'text-[#2563EB]' },
  'Bills': { bg: 'bg-[#FCE8E8]', fg: 'text-[#DC2626]' },
  'Shopping': { bg: 'bg-[#F3E8FD]', fg: 'text-[#9333EA]' },
  'Transfers': { bg: 'bg-[#E3FCFC]', fg: 'text-[#00A3A3]' },
  'Savings': { bg: 'bg-[#E6FBF3]', fg: 'text-[#10B981]' },
  'Income': { bg: 'bg-[#EAF6DA]', fg: 'text-[#4D7C0F]' },
  'Other': { bg: 'bg-slate-100', fg: 'text-slate-500' },
};

function guessCategory(entry: HistoryEntry): Category {
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

export default function MoneyTracker({ history, loading, onRefresh }: MoneyTrackerProps) {
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [activeFilter, setActiveFilter] = useState<Category | 'All'>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const categorized = useMemo(
    () => history.map((entry) => ({ entry, category: overrides[entry.id] ?? guessCategory(entry) })),
    [history, overrides]
  );

  const presentCategories = useMemo(() => {
    const set = new Set<Category>();
    categorized.forEach(({ category }) => set.add(category));
    return CATEGORIES.filter((c) => set.has(c));
  }, [categorized]);

  const filtered = useMemo(() => {
    return categorized.filter(({ entry, category }) => {
      if (activeFilter !== 'All' && category !== activeFilter) return false;
      if (query.trim() && !`${entry.title} ${entry.description}`.toLowerCase().includes(query.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categorized, activeFilter, query]);

  const totalsByCategory = useMemo(() => {
    const totals: Partial<Record<Category, number>> = {};
    categorized.forEach(({ entry, category }) => {
      totals[category] = (totals[category] ?? 0) + entry.amount;
    });
    return totals;
  }, [categorized]);

  const getIconColorClass = () => {
    if (loading) return 'text-cyan-500 animate-spin';
    if (history.length === 0) return 'text-orange-500';
    return 'text-slate-400';
  };

  return (
    <div className="px-6 py-2 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">Money Tracker</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
          aria-label="Sync data"
        >
          <RefreshIcon className={`w-5 h-5 transition-colors ${getIconColorClass()}`} />
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transactions"
        className="w-full rounded-2xl bg-white border border-slate-200/60 px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-orange-200 placeholder:text-slate-300 shadow-sm"
      />

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setActiveFilter('All')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
            activeFilter === 'All'
              ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
              : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          All
        </button>
        {presentCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
              activeFilter === cat
                ? `${CATEGORY_STYLE[cat].bg} ${CATEGORY_STYLE[cat].fg} border-transparent`
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Category totals summary (only for the active filter, to keep it compact) */}
      {activeFilter !== 'All' && (
        <div className="px-1 text-[11px] text-slate-400">
          <span className={`font-semibold ${CATEGORY_STYLE[activeFilter].fg}`}>{activeFilter}</span>
          {' · '}
          {(totalsByCategory[activeFilter] ?? 0).toFixed(2)} total across {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-normal text-slate-400 text-center shadow-md shadow-slate-900/5">
            {history.length === 0 ? 'No transactions recorded yet.' : 'No transactions match this filter.'}
          </p>
        ) : (
          filtered.map(({ entry, category }) => {
            const style = CATEGORY_STYLE[category];
            const isEditing = editingId === entry.id;

            return (
              <div
                key={entry.id}
                className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 space-y-3"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full ${style.bg} ${style.fg} flex items-center justify-center shrink-0 font-bold shadow-inner text-xs`}>
                    {category.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs text-slate-800 truncate">{entry.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">{entry.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-800">{entry.amount.toFixed(2)}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setEditingId(isEditing ? null : entry.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${style.bg} ${style.fg}`}
                  >
                    {category}
                  </button>
                  <button
                    onClick={() => setEditingId(isEditing ? null : entry.id)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                  >
                    {isEditing ? 'Close' : 'Edit category'}
                  </button>
                </div>

                {isEditing && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setOverrides((prev) => ({ ...prev, [entry.id]: cat }));
                          setEditingId(null);
                        }}
                        className={`mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                          cat === category
                            ? `${CATEGORY_STYLE[cat].bg} ${CATEGORY_STYLE[cat].fg} border-transparent`
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
