'use client';

import React, { useMemo, useState } from 'react';
import { type HistoryEntry } from '@/lib/history';
import {
  CATEGORY_STYLE,
  type Category,
  isVaultEntry,
  signedVaultAmount,
  monthKey,
  monthLabel,
  lastMonthKeys,
} from '@/lib/spendCategories';

const MONTHS_SHOWN = 6;
const MONTH_PALETTE = ['#FF9F1C', '#00A3A3', '#6366F1', '#EC4899', '#10B981', '#F59E0B'];

type Zone = 'vault' | 'wallet';

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

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v10l8.66 5A10 10 0 1 0 12 2z" />
    </svg>
  );
}

function ChartViewToggle({ view, onChange }: { view: 'bar' | 'pie'; onChange: (v: 'bar' | 'pie') => void }) {
  return (
    <div className="flex shrink-0 p-0.5 bg-slate-100 rounded-full">
      <button
        type="button"
        aria-label="Bar chart view"
        aria-pressed={view === 'bar'}
        onClick={() => onChange('bar')}
        className={`p-1.5 rounded-full transition-colors ${view === 'bar' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
      >
        <BarChartIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        aria-label="Pie chart view"
        aria-pressed={view === 'pie'}
        onClick={() => onChange('pie')}
        className={`p-1.5 rounded-full transition-colors ${view === 'pie' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
      >
        <PieChartIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface StatsProps {
  history: HistoryEntry[];
  categorized: { entry: HistoryEntry; category: Category }[];
  loading: boolean;
}

export default function Stats({ history, categorized, loading }: StatsProps) {
  const [showStats, setShowStats] = useState(true);
  const [zone, setZone] = useState<Zone>('wallet');
  const [vaultChartView, setVaultChartView] = useState<'bar' | 'pie'>('bar');
  const [walletChartView, setWalletChartView] = useState<'bar' | 'pie'>('bar');

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

  if (loading && history.length === 0) {
    return <div className="h-40 rounded-3xl bg-slate-50 animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowStats((v) => !v)}
        className="w-full flex items-center justify-between px-1"
      >
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-6 3 3 5-8" />
          </svg>
          Statistics
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-300 transition-transform ${showStats ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showStats && (
        <div className="space-y-3 animate-fadeIn">
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
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-amber-50 text-[#FF9F1C] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path strokeLinecap="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">This month, net</p>
                    <p className={`text-2xl font-bold leading-tight ${vaultCurrentNet >= 0 ? 'text-[#1A1A1A]' : 'text-red-500'}`}>
                      {vaultCurrentNet >= 0 ? '+' : ''}
                      {vaultCurrentNet.toFixed(2)}
                    </p>
                  </div>
                </div>
                <TrendBadge current={vaultCurrentNet} previous={vaultPreviousNet} goodDirection="up" />
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Savings growth</p>
                <MiniLineChart labels={monthLabels} values={vaultCumulative} color="#00A3A3" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Deposits vs withdrawals
                  </p>
                  <ChartViewToggle view={vaultChartView} onChange={setVaultChartView} />
                </div>
                {vaultChartView === 'bar' ? (
                  <MiniBarChart labels={monthLabels} values={vaultMonthlyNet} color="#10B981" negativeColor="#DC2626" />
                ) : (
                  <div className="flex items-center gap-5 pt-2">
                    <DonutChart
                      segments={[
                        { label: 'Deposits', value: vaultMonthlyNet.filter((v) => v > 0).reduce((s, v) => s + v, 0), color: '#10B981' },
                        { label: 'Withdrawals', value: vaultMonthlyNet.filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0), color: '#DC2626' },
                      ]}
                    />
                    <div className="flex-1 space-y-1.5">
                      {[
                        { label: 'Deposits', value: vaultMonthlyNet.filter((v) => v > 0).reduce((s, v) => s + v, 0), color: '#10B981' },
                        { label: 'Withdrawals', value: vaultMonthlyNet.filter((v) => v < 0).reduce((s, v) => s + Math.abs(v), 0), color: '#DC2626' },
                      ].map((seg) => (
                        <div key={seg.label} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                            {seg.label}
                          </span>
                          <span className="text-slate-700 font-semibold">{seg.value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="2" y="6" width="20" height="14" rx="3" />
                      <path strokeLinecap="round" d="M2 10h20" />
                      <circle cx="17" cy="15" r="1.4" fill="currentColor" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Spent this month</p>
                    <p className="text-2xl font-bold leading-tight text-[#1A1A1A]">{spendThisMonth.toFixed(2)}</p>
                  </div>
                </div>
                <TrendBadge current={spendThisMonth} previous={spendLastMonth} goodDirection="down" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Spending, last {MONTHS_SHOWN} months
                  </p>
                  <ChartViewToggle view={walletChartView} onChange={setWalletChartView} />
                </div>
                {walletChartView === 'bar' ? (
                  <MiniBarChart labels={monthLabels} values={walletMonthlySpend} color="#FF9F1C" />
                ) : (
                  <div className="flex items-center gap-5 pt-2">
                    <DonutChart
                      segments={monthLabels.map((label, i) => ({
                        label,
                        value: walletMonthlySpend[i],
                        color: MONTH_PALETTE[i % MONTH_PALETTE.length],
                      }))}
                    />
                    <div className="flex-1 space-y-1.5">
                      {monthLabels.map((label, i) => (
                        <div key={label} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: MONTH_PALETTE[i % MONTH_PALETTE.length] }}
                            />
                            {label}
                          </span>
                          <span className="text-slate-700 font-semibold">{walletMonthlySpend[i].toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}