"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  CreditCustomTemplate,
  CreditOutputFormat,
  CreditSelection,
  Musician,
} from "@/types/musician";
import { CREDIT_FORMAT_OPTIONS, DEFAULT_CUSTOM_TEMPLATE } from "./formats";
import { makeSelectionFromMusician, sortSelections } from "./selection";

/**
 * localStorage-backed credit builder state (v0.1).
 *
 * Selections (including temporary overrides) live only in the browser.
 * They are never written to the musicians table.
 *
 * Implemented as small external stores consumed via useSyncExternalStore so
 * that SSR/hydration stays consistent and every component on the page shares
 * the same state.
 */

type LocalStore<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  update: (updater: (prev: T) => T) => void;
};

function createLocalStore<T>(
  key: string,
  fallback: T,
  normalize: (value: unknown) => T | null,
): LocalStore<T> {
  let cached = fallback;
  let initialized = false;
  const listeners = new Set<() => void>();

  function readFromStorage(): void {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const normalized = normalize(JSON.parse(raw));
        if (normalized !== null) cached = normalized;
      }
    } catch {
      // unreadable storage (privacy mode etc.): keep the fallback
    }
    initialized = true;
  }

  function ensureInitialized(): void {
    if (!initialized && typeof window !== "undefined") readFromStorage();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      ensureInitialized();
      return cached;
    },
    getServerSnapshot() {
      return fallback;
    },
    update(updater) {
      ensureInitialized();
      cached = updater(cached);
      try {
        window.localStorage.setItem(key, JSON.stringify(cached));
      } catch {
        // storage full / privacy mode: state just won't persist
      }
      for (const listener of listeners) listener();
    },
  };
}

const selectionsStore = createLocalStore<CreditSelection[]>(
  "emn.credit.selections.v1",
  [],
  (value) =>
    Array.isArray(value) ? sortSelections(value as CreditSelection[]) : null,
);

const modeStore = createLocalStore<boolean>(
  "emn.credit.mode.v1",
  false,
  (value) => (typeof value === "boolean" ? value : null),
);

const templateStore = createLocalStore<CreditCustomTemplate>(
  "emn.credit.customTemplate.v1",
  DEFAULT_CUSTOM_TEMPLATE,
  (value) => {
    if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as CreditCustomTemplate).personTemplate === "string"
    ) {
      return { ...DEFAULT_CUSTOM_TEMPLATE, ...(value as CreditCustomTemplate) };
    }
    return null;
  },
);

const FORMAT_VALUES = new Set<string>(CREDIT_FORMAT_OPTIONS.map((o) => o.value));

const formatStore = createLocalStore<CreditOutputFormat>(
  "emn.credit.format.v1",
  "emn_minimal",
  (value) =>
    typeof value === "string" && FORMAT_VALUES.has(value)
      ? (value as CreditOutputFormat)
      : null,
);

const emptySubscribe = () => () => {};

/** false during SSR/hydration, true once client state is authoritative. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function useCreditSelections() {
  const selections = useSyncExternalStore(
    selectionsStore.subscribe,
    selectionsStore.getSnapshot,
    selectionsStore.getServerSnapshot,
  );
  const loaded = useHydrated();

  const isSelected = useCallback(
    (musicianId: string) => selections.some((s) => s.musicianId === musicianId),
    [selections],
  );

  const addMusician = useCallback((musician: Musician) => {
    selectionsStore.update((prev) =>
      prev.some((s) => s.musicianId === musician.id)
        ? prev
        : sortSelections([...prev, makeSelectionFromMusician(musician, prev.length)]),
    );
  }, []);

  const removeMusician = useCallback((musicianId: string) => {
    selectionsStore.update((prev) =>
      sortSelections(prev.filter((s) => s.musicianId !== musicianId)),
    );
  }, []);

  const toggleMusician = useCallback((musician: Musician) => {
    selectionsStore.update((prev) =>
      sortSelections(
        prev.some((s) => s.musicianId === musician.id)
          ? prev.filter((s) => s.musicianId !== musician.id)
          : [...prev, makeSelectionFromMusician(musician, prev.length)],
      ),
    );
  }, []);

  const clearSelections = useCallback(() => {
    selectionsStore.update(() => []);
  }, []);

  const move = useCallback((musicianId: string, direction: -1 | 1) => {
    selectionsStore.update((prev) => {
      const index = prev.findIndex((s) => s.musicianId === musicianId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const patchSelection = useCallback(
    (musicianId: string, patch: Partial<CreditSelection>) => {
      selectionsStore.update((prev) =>
        prev.map((s) => (s.musicianId === musicianId ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const resetOverrides = useCallback((musicianId: string) => {
    selectionsStore.update((prev) =>
      prev.map((s) =>
        s.musicianId === musicianId
          ? {
              musicianId: s.musicianId,
              slug: s.slug,
              sourceMusician: s.sourceMusician,
              order: s.order,
            }
          : s,
      ),
    );
  }, []);

  return {
    selections,
    loaded,
    isSelected,
    addMusician,
    removeMusician,
    toggleMusician,
    clearSelections,
    move,
    patchSelection,
    resetOverrides,
  };
}

export function useCreditMode() {
  const creditMode = useSyncExternalStore(
    modeStore.subscribe,
    modeStore.getSnapshot,
    modeStore.getServerSnapshot,
  );
  const setCreditMode = useCallback((on: boolean) => {
    modeStore.update(() => on);
  }, []);
  return { creditMode, setCreditMode };
}

export function useCustomTemplate() {
  const template = useSyncExternalStore(
    templateStore.subscribe,
    templateStore.getSnapshot,
    templateStore.getServerSnapshot,
  );
  const updateTemplate = useCallback((patch: Partial<CreditCustomTemplate>) => {
    templateStore.update((prev) => ({ ...prev, ...patch }));
  }, []);
  return { template, updateTemplate };
}

export function useCreditFormat() {
  const format = useSyncExternalStore(
    formatStore.subscribe,
    formatStore.getSnapshot,
    formatStore.getServerSnapshot,
  );
  const setFormat = useCallback((value: string) => {
    if (!FORMAT_VALUES.has(value)) return;
    formatStore.update(() => value as CreditOutputFormat);
  }, []);
  return { format, setFormat };
}
