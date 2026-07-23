'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type HistoryEntry } from '@/lib/history';
import { type Category, currentMonthKey, guessCategory, isVaultEntry, monthKey } from '@/lib/spendCategories';

export interface Budget {
  id: string;
  category: Category;
  limit: number;
  /** Set when the envelope was seeded from a vault's target amount, so the
   *  UI can badge it ("Linked to <vault name>") instead of treating it as
   *  an arbitrary manual budget. */
  linkedVaultId?: string;
  linkedVaultName?: string;
  createdAt: number;
}

const STORAGE_KEY = 'stella-vault:budgets';

function loadFromStorage(): Budget[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Budget[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(budgets: Budget[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
  } catch {
    // best-effort only
  }
}

interface BudgetContextValue {
  budgets: Budget[];
  addBudget: (input: { category: Category; limit: number; linkedVaultId?: string; linkedVaultName?: string }) => Budget;
  updateBudget: (id: string, patch: Partial<Pick<Budget, 'limit' | 'category'>>) => void;
  removeBudget: (id: string) => void;
  /** Amount spent this month in a category. Categorization here always uses
   *  the automatic guess (not the per-entry overrides a user may have set
   *  in the Money Tracker list), since budgets aren't scoped to one screen. */
  spentThisMonth: (category: Category) => number;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

export function BudgetProvider({ children, history }: { children: React.ReactNode; history: HistoryEntry[] }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBudgets(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveToStorage(budgets);
  }, [budgets, hydrated]);

  const addBudget: BudgetContextValue['addBudget'] = useCallback((input) => {
    const existing = budgets.find((b) => b.category === input.category);
    if (existing) {
      const updated: Budget = {
        ...existing,
        limit: input.limit,
        linkedVaultId: input.linkedVaultId ?? existing.linkedVaultId,
        linkedVaultName: input.linkedVaultName ?? existing.linkedVaultName,
      };
      setBudgets((prev) => prev.map((b) => (b.id === existing.id ? updated : b)));
      return updated;
    }
    const created: Budget = {
      id: `budget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: input.category,
      limit: input.limit,
      linkedVaultId: input.linkedVaultId,
      linkedVaultName: input.linkedVaultName,
      createdAt: Date.now(),
    };
    setBudgets((prev) => [...prev, created]);
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets]);

  const updateBudget: BudgetContextValue['updateBudget'] = useCallback((id, patch) => {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const removeBudget: BudgetContextValue['removeBudget'] = useCallback((id) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const spentByCategory = useMemo(() => {
    const key = currentMonthKey();
    const totals: Partial<Record<Category, number>> = {};
    history.forEach((entry) => {
      if (isVaultEntry(entry) && entry.kind !== 'withdraw') return; // deposits aren't "spend"
      if (monthKey(entry.timestamp) !== key) return;
      const cat = guessCategory(entry);
      totals[cat] = (totals[cat] ?? 0) + Math.abs(entry.amount);
    });
    return totals;
  }, [history]);

  const spentThisMonth = useCallback((category: Category) => spentByCategory[category] ?? 0, [spentByCategory]);

  const value = useMemo(
    () => ({ budgets, addBudget, updateBudget, removeBudget, spentThisMonth }),
    [budgets, addBudget, updateBudget, removeBudget, spentThisMonth]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudgets() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudgets must be used within a BudgetProvider');
  return ctx;
}
