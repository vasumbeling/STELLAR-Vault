'use client';

import React, { useState } from 'react';
import { useBudgets } from '@/lib/budgets';
import { BUDGETABLE_CATEGORIES, CATEGORY_STYLE, type Category } from '@/lib/spendCategories';

/** Envelope-style budget allocation: create/edit per-category limits, see
 *  progress against this month's spend, and get flagged when over limit.
 *  Rendered inline (e.g. as an expandable panel from the Money Tracker's
 *  wallet statistics view), so it has no header/nav chrome of its own. */
export default function Budgets() {
  const { budgets, addBudget, updateBudget, removeBudget, spentThisMonth } = useBudgets();
  const [addingCategory, setAddingCategory] = useState<Category | null>(null);
  const [draftLimit, setDraftLimit] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState('');

  const usedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = BUDGETABLE_CATEGORIES.filter((c) => !usedCategories.has(c));

  const startAdd = (category: Category) => {
    setAddingCategory(category);
    setDraftLimit('');
  };

  const confirmAdd = () => {
    const limit = Number(draftLimit);
    if (!addingCategory || !isFinite(limit) || limit <= 0) return;
    addBudget({ category: addingCategory, limit });
    setAddingCategory(null);
    setDraftLimit('');
  };

  const startEdit = (id: string, current: number) => {
    setEditingId(id);
    setEditLimit(String(current));
  };

  const confirmEdit = (id: string) => {
    const limit = Number(editLimit);
    if (!isFinite(limit) || limit <= 0) return;
    updateBudget(id, { limit });
    setEditingId(null);
  };

  const overLimitCount = budgets.filter((b) => spentThisMonth(b.category) > b.limit).length;

  return (
    <div className="space-y-3">
      {overLimitCount > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-red-50 border border-red-100">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.72 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[11px] font-semibold text-red-600">
            {overLimitCount} {overLimitCount === 1 ? 'envelope is' : 'envelopes are'} over budget this month.
          </p>
        </div>
      )}

      {budgets.length === 0 && (
        <p className="text-xs text-slate-300 px-1">No budgets set yet. Add one below to start tracking a category.</p>
      )}

      <div className="space-y-2.5">
        {budgets.map((b) => {
          const style = CATEGORY_STYLE[b.category];
          const spent = spentThisMonth(b.category);
          const pct = b.limit > 0 ? Math.min(100, (spent / b.limit) * 100) : 0;
          const isOver = spent > b.limit;
          const isEditing = editingId === b.id;

          return (
            <div key={b.id} className="p-4 rounded-2xl bg-white border border-slate-200/60 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.fg}`}>
                    {b.category}
                  </span>
                  {b.linkedVaultName && (
                    <span className="text-[9px] font-medium text-slate-400">Linked to {b.linkedVaultName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        autoFocus
                        className="w-16 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-orange-200"
                      />
                      <button onClick={() => confirmEdit(b.id)} className="text-[10px] font-semibold text-emerald-600">
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] font-semibold text-slate-400">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(b.id, b.limit)} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600">
                        {spent.toFixed(0)} / {b.limit.toFixed(0)}
                      </button>
                      <button onClick={() => removeBudget(b.id)} className="text-slate-300 hover:text-red-400" aria-label="Remove budget">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: isOver ? '#DC2626' : style.bar }}
                />
              </div>
              {isOver && (
                <p className="text-[10px] font-semibold text-red-500">
                  Over by {(spent - b.limit).toFixed(0)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new envelope */}
      {addingCategory ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            Monthly limit for {addingCategory}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
              placeholder="e.g. 3000"
              autoFocus
              className="flex-1 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-orange-200 placeholder:text-slate-300"
            />
            <span className="text-[10px] text-slate-400">USDC</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmAdd}
              disabled={!draftLimit || Number(draftLimit) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest font-normal disabled:opacity-40"
            >
              Create Envelope
            </button>
            <button
              onClick={() => setAddingCategory(null)}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-[10px] uppercase tracking-wide text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : availableCategories.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => startAdd(cat)}
              className="px-3 py-1.5 rounded-full text-[10px] font-semibold border border-dashed border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
            >
              + {cat}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
