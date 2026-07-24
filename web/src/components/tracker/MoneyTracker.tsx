'use client';

import React, { useMemo, useState } from 'react';
import { type HistoryEntry } from '@/lib/history';
import { RefreshIcon } from '@/app/icons';
import {
  CATEGORIES,
  CATEGORY_STYLE,
  type Category,
  guessCategory,
} from '@/lib/spendCategories';
import Stats from './Stats';
import Budget from './Budget';

interface MoneyTrackerProps {
  history: HistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
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

      {/* ---------------- Statistics component ---------------- */}
      <Stats history={history} categorized={categorized} loading={loading} />

      {/* ---------------- Budgets component ---------------- */}
      <Budget loading={loading} historyLength={history.length} />

      {/* Search */}
      <div className="relative flex items-center">
        <svg className="absolute left-4 w-4 h-4 text-slate-300 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transactions"
          className="w-full rounded-full bg-slate-50 border border-slate-100 pl-10 pr-10 py-3 text-xs text-slate-800 outline-none focus:border-orange-200 focus:bg-white placeholder:text-slate-300 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
          >
            <svg className="w-2.5 h-2.5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="relative -mx-1">
        <div className="flex gap-2 overflow-x-auto pb-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveFilter('All')}
            className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold border transition-colors ${
              activeFilter === 'All'
                ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            All
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold border transition-colors ${
                activeFilter === cat
                  ? 'bg-white border-slate-800/10 text-slate-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_STYLE[cat].bar }} />
              {cat}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-linear-to-l from-[#fffdfb] to-transparent" />
      </div>

      {/* Results summary */}
      {(activeFilter !== 'All' || query.trim()) && (
        <div className="px-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {activeFilter !== 'All' && (
              <span className={`font-semibold ${CATEGORY_STYLE[activeFilter].fg}`}>{activeFilter}{' · '}</span>
            )}
            {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
            {activeFilter !== 'All' && ` · ${(totalsByCategory[activeFilter] ?? 0).toFixed(2)} total`}
          </span>
          {(activeFilter !== 'All' || query.trim()) && (
            <button
              onClick={() => { setActiveFilter('All'); setQuery(''); }}
              className="font-semibold text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="p-6 rounded-3xl bg-white border border-slate-100 text-xs font-normal text-slate-400 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]">
            {history.length === 0 ? 'No transactions recorded yet.' : 'No transactions match this filter.'}
          </p>
        ) : (
          filtered.map(({ entry, category }) => {
            const style = CATEGORY_STYLE[category];
            const isEditing = editingId === entry.id;
            const isCredit = entry.amount >= 0;

            return (
              <div
                key={entry.id}
                className="relative pl-5 pr-4 py-4 rounded-3xl bg-white border border-slate-100 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-3 overflow-hidden transition-shadow hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.12)]"
              >
                <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: style.bar }} />

                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-full ${style.bg} ${style.fg} flex items-center justify-center shrink-0 font-bold text-sm`}>
                    {category.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[13px] text-slate-800 truncate">{entry.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">{entry.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[13px] font-bold ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {isCredit ? '+' : ''}{entry.amount.toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.fg}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: style.bar }} />
                    {category}
                  </span>
                  <button
                    onClick={() => setEditingId(isEditing ? null : entry.id)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-cyan-600 hover:text-cyan-700"
                  >
                    {isEditing ? (
                      'Close'
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit category
                      </>
                    )}
                  </button>
                </div>

                {isEditing && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
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
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
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