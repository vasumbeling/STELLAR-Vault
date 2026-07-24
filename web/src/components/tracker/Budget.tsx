'use client';

import React, { useState } from 'react';
import { useBudgets } from '@/lib/budgets';
import { CATEGORIES, CATEGORY_STYLE, type Category } from '@/lib/spendCategories';

interface BudgetProps {
  loading: boolean;
  historyLength: number;
}

export default function Budget({ loading, historyLength }: BudgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inputLimit, setInputLimit] = useState<string>('');

  const { budgets, setBudget, spentThisMonth } = useBudgets();

  const activeBudgets = budgets.filter((b) => b.limit > 0);
  const overBudgetCount = activeBudgets.filter((b) => spentThisMonth(b.category) > b.limit).length;

  const totalLimit = activeBudgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpent = activeBudgets.reduce((acc, b) => acc + spentThisMonth(b.category), 0);

  if (loading && historyLength === 0) {
    return null;
  }

  const handleSaveBudget = (cat: Category) => {
    const val = parseFloat(inputLimit);
    if (!isNaN(val) && val >= 0) {
      setBudget(cat, val);
    }
    setEditingCategory(null);
    setInputLimit('');
  };

  return (
    <div className="relative my-3">
      {/* ---------------- Dashboard Envelope Slot ---------------- */}
      <div className="relative w-full rounded-2xl bg-[#fffdfb] border border-slate-200/60 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 overflow-hidden">
        
        {/* Envelope Top Header / Toggle */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 cursor-pointer text-left focus:outline-none hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {/* Minimal SVG Envelope Icon */}
            <svg
              className={`w-4 h-4 transition-colors ${isOpen ? 'text-[#1A1A1A]' : 'text-slate-400'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="m2 5 10 7 10-7" />
            </svg>
            
            <span className="text-xs font-semibold text-[#1A1A1A] tracking-tight">
              Budget Envelope
            </span>

            {overBudgetCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isOpen && totalLimit > 0 && (
              <span className="text-[11px] font-medium text-slate-400">
                ${totalSpent.toFixed(0)} / ${totalLimit.toFixed(0)}
              </span>
            )}
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* ---------------- Minimal Envelope Content ---------------- */}
        {isOpen && (
          <div className="px-4 pb-4 animate-fadeIn">
            <div className="pt-3 border-t border-slate-100 space-y-4">
              
              {/* Total Monthly Summary Banner */}
              {totalLimit > 0 && (
                <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium">Monthly Total</span>
                  <span className="font-semibold text-[#1A1A1A]">
                    ${totalSpent.toFixed(2)}{' '}
                    <span className="text-slate-400 font-normal">/ ${totalLimit.toFixed(2)}</span>
                  </span>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Category Limits</span>
                <button
                  onClick={() => setIsEditing((v) => !v)}
                  className="font-semibold text-[#FF9F1C] hover:text-[#f37a00] transition-colors cursor-pointer"
                >
                  {isEditing ? 'Done' : 'Manage'}
                </button>
              </div>

              {/* Minimal Category Items */}
              <div className="space-y-3">
                {CATEGORIES.map((category) => {
                  const style = CATEGORY_STYLE[category];
                  const spent = spentThisMonth(category);
                  const budget = budgets.find((b) => b.category === category);
                  const limit = budget?.limit ?? 0;
                  const isOver = limit > 0 && spent > limit;
                  const percent = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;

                  if (!isEditing && limit === 0) return null;

                  return (
                    <div key={category} className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/60 border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.bar }} />
                          <span className="font-semibold text-[#1A1A1A]">{category}</span>
                        </div>

                        {editingCategory === category ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={inputLimit}
                              onChange={(e) => setInputLimit(e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#FF9F1C]"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveBudget(category)}
                              className="text-[11px] font-bold text-[#FF9F1C] px-1.5 py-0.5 hover:underline cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className={isOver ? 'text-red-500 font-semibold' : 'text-[#1A1A1A] font-medium'}>
                              ${spent.toFixed(0)}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-400">{limit > 0 ? `$${limit.toFixed(0)}` : '—'}</span>
                            {isEditing && (
                              <button
                                onClick={() => {
                                  setEditingCategory(category);
                                  setInputLimit(limit > 0 ? limit.toString() : '');
                                }}
                                className="ml-1 text-slate-400 hover:text-[#FF9F1C] transition-colors"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Clean Slate Line Indicator */}
                      {limit > 0 && (
                        <div className="w-full h-1 bg-slate-200/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${isOver ? 'bg-red-500' : 'bg-[#FF9F1C]'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {activeBudgets.length === 0 && !isEditing && (
                  <div className="text-center py-4 px-3 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-[11px] text-slate-400">Your budget envelope is empty.</p>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="mt-1 text-xs font-semibold text-[#FF9F1C] hover:underline"
                    >
                      Configure category limits
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}