'use client';

import React, { useMemo, useState } from 'react';
import { type HistoryEntry } from '@/lib/history';
import { RefreshIcon } from '@/app/icons';
import { useBudgets } from '@/lib/budgets';
import Budgets from '@/components/budgets/Budgets';
import {
  CATEGORIES,
  CATEGORY_STYLE,
  type Category,
  guessCategory,
  isVaultEntry,
  signedVaultAmount,
  monthKey,
  monthLabel,
  lastMonthKeys,
} from '@/lib/spendCategories';

interface MoneyTrackerProps {
  history: HistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
}

const MONTHS_SHOWN = 6;

function TrendBadge({ current, previous, goodDirection }: { current: number; previous: number; goodDirection: 'up' | 'down' }) {
  if (previous === 0 && current === 0) {
    return <span className="text-[10px] font-semibold text-slate-300">No activity yet</span>;
  }
  const pct = previous === 0 ? 100 : ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct >= 0;
  const isGood = isUp ? goodDirection === 'up' : goodDirection === 'down';
  const color = isGood ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>
      <svg
        className={`w-3 h-3 ${isUp ? '' : 'rotate-180'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {Math.abs(pct).toFixed(0)}% vs last month
    </span>
  );
}

/** Simple SVG bar chart. Values can be negative (drawn below the baseline). */
function MiniBarChart({
  labels,
  values,
  color,
  negativeColor,
}: {
  labels: string[];
  values: number[];
  color: string;
  negativeColor?: string;
}) {
  const width = 320;
  const height = 120;
  const baseline = height / 2;
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  const barWidth = width / labels.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
      <line x1="0" y1={baseline} x2={width} y2={baseline} stroke="#F1F5F9" strokeWidth="1" />
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * (height / 2 - 12);
        const x = i * barWidth + barWidth * 0.25;
        const barW = barWidth * 0.5;
        const y = v >= 0 ? baseline - h : baseline;
        const fill = v >= 0 ? color : negativeColor ?? '#DC2626';
        return <rect key={labels[i]} x={x} y={y} width={barW} height={Math.max(h, 1)} rx={3} fill={fill} opacity={0.9} />;
      })}
      {labels.map((label, i) => (
        <text key={label} x={i * barWidth + barWidth / 2} y={height - 2} textAnchor="middle" fontSize="9" fill="#94A3B8">
          {label}
        </text>
      ))}
    </svg>
  );
}

/** Simple SVG cumulative line chart. */
function MiniLineChart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const width = 320;
  const height = 120;
  const padTop = 12;
  const padBottom = 18;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const stepX = width / Math.max(1, labels.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${height - padBottom} L 0 ${height - padBottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3 : 2} fill={color} />
      ))}
      {labels.map((label, i) => (
        <text key={label} x={i * stepX} y={height - 2} textAnchor="middle" fontSize="9" fill="#94A3B8">
          {label}
        </text>
      ))}
    </svg>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const size = 96;
  const radius = 40;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      </svg>
    );
  }

  let offsetAcc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {segments.map((seg) => {
        if (seg.value <= 0) return null;
        const fraction = seg.value / total;
        const dash = fraction * circumference;
        const gap = circumference - dash;
        const dashoffset = -offsetAcc;
        offsetAcc += dash;
        return (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={dashoffset}
          />
        );
      })}
    </svg>
  );
}

type Zone = 'vault' | 'wallet';

export default function MoneyTracker({ history, loading, onRefresh }: MoneyTrackerProps) {
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [activeFilter, setActiveFilter] = useState<Category | 'All'>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState<Zone>('wallet');
  const [showBudgets, setShowBudgets] = useState(false);
  const { budgets, spentThisMonth } = useBudgets();
  const overBudgetCount = budgets.filter((b) => spentThisMonth(b.category) > b.limit).length;

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

  // ----------------------------------------------------------------
  // Statistics summary (above the list): vault vs wallet zone split
  // ----------------------------------------------------------------
  const months = useMemo(() => lastMonthKeys(MONTHS_SHOWN), []);
  const currentMonthKey = months[months.length - 1];

  const vaultEntries = useMemo(() => history.filter(isVaultEntry), [history]);

  const vaultMonthlyNet = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach((m) => (totals[m] = 0));
    vaultEntries.forEach((e) => {
      const k = monthKey(e.timestamp);
      if (k in totals) totals[k] += signedVaultAmount(e);
    });
    return months.map((m) => totals[m]);
  }, [vaultEntries, months]);

  const vaultCumulative = useMemo(() => {
    let running = 0;
    return vaultMonthlyNet.map((v) => (running += v));
  }, [vaultMonthlyNet]);

  const vaultCurrentNet = vaultMonthlyNet[vaultMonthlyNet.length - 1] ?? 0;
  const vaultPreviousNet = vaultMonthlyNet[vaultMonthlyNet.length - 2] ?? 0;

  // Wallet spend uses the same categorized (override-aware) data as the list below,
  // so the two views never disagree about what something is.
  const walletMonthlySpend = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach((m) => (totals[m] = 0));
    categorized.forEach(({ entry, category }) => {
      if (isVaultEntry(entry) || category === 'Income') return;
      const k = monthKey(entry.timestamp);
      if (k in totals) totals[k] += Math.abs(entry.amount);
    });
    return months.map((m) => totals[m]);
  }, [categorized, months]);

  const spendThisMonth = walletMonthlySpend[walletMonthlySpend.length - 1] ?? 0;
  const spendLastMonth = walletMonthlySpend[walletMonthlySpend.length - 2] ?? 0;

  const categoryBreakdown = useMemo(() => {
    const totals: Partial<Record<Category, number>> = {};
    categorized
      .filter(({ entry, category }) => !isVaultEntry(entry) && category !== 'Income' && monthKey(entry.timestamp) === currentMonthKey)
      .forEach(({ entry, category }) => {
        totals[category] = (totals[category] ?? 0) + Math.abs(entry.amount);
      });
    return (Object.entries(totals) as [Category, number][])
      .map(([label, value]) => ({ label, value, color: CATEGORY_STYLE[label].bar }))
      .sort((a, b) => b.value - a.value);
  }, [categorized, currentMonthKey]);

  const categoryTotal = categoryBreakdown.reduce((s, c) => s + c.value, 0);
  const monthLabels = months.map(monthLabel);

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

      {/* ---------------- Statistics summary ---------------- */}
      {loading && history.length === 0 ? (
        <div className="h-40 rounded-3xl bg-slate-50 animate-pulse" />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end px-1">
            <div className="flex p-0.5 rounded-full bg-slate-100">
              {(['vault', 'wallet'] as Zone[]).map((z) => (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                    zone === z ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-400'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {zone === 'vault' ? (
            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">This month, net</p>
                  <p className={`text-2xl font-bold ${vaultCurrentNet >= 0 ? 'text-[#1A1A1A]' : 'text-red-500'}`}>
                    {vaultCurrentNet >= 0 ? '+' : ''}
                    {vaultCurrentNet.toFixed(2)}
                  </p>
                </div>
                <TrendBadge current={vaultCurrentNet} previous={vaultPreviousNet} goodDirection="up" />
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Savings growth</p>
                <MiniLineChart labels={monthLabels} values={vaultCumulative} color="#00A3A3" />
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Deposits vs withdrawals
                </p>
                <MiniBarChart labels={monthLabels} values={vaultMonthlyNet} color="#10B981" negativeColor="#DC2626" />
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Spent this month</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">{spendThisMonth.toFixed(2)}</p>
                </div>
                <TrendBadge current={spendThisMonth} previous={spendLastMonth} goodDirection="down" />
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Spending, last {MONTHS_SHOWN} months
                </p>
                <MiniBarChart labels={monthLabels} values={walletMonthlySpend} color="#FF9F1C" />
              </div>

              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Where it went this month
                </p>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-300">No spending recorded this month.</p>
                ) : (
                  <div className="flex items-center gap-5">
                    <DonutChart segments={categoryBreakdown} />
                    <div className="flex-1 space-y-1.5">
                      {categoryBreakdown.map((c) => (
                        <div key={c.label} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            {c.label}
                          </span>
                          <span className="text-slate-700 font-semibold">
                            {categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-1 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => setShowBudgets((v) => !v)}
                  className="w-full flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
                >
                  <span className="flex items-center gap-2">
                    Budgets
                    {overBudgetCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 normal-case font-bold tracking-normal">
                        {overBudgetCount} over
                      </span>
                    )}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-300 transition-transform ${showBudgets ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showBudgets && <Budgets />}
              </div>
            </div>
          )}
        </div>
      )}

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