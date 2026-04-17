import { vi } from "vitest";

export type QueryResult = {
  data?: unknown;
  error?: { message: string; [key: string]: unknown } | null;
  count?: number | null;
};

const SUPPORTED_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "in",
  "single",
  "maybeSingle",
  "order",
  "limit",
] as const;

type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

const _callCounters: Record<string, number> = {};
let _stubs: Record<string, QueryResult[]> = {};

// ---------------------------------------------------------------------------
// Chain factory (internal)
// ---------------------------------------------------------------------------

function makeChain(table: string, callIndex: number) {
  const getResult = (): QueryResult => {
    const tableStubs = _stubs[table];
    if (!tableStubs) {
      throw new Error(
        `[Supabase Mock] No stub configured for table "${table}". ` +
          `Call stubSupabaseTables({ ${table}: [...] }) before this test runs.`,
      );
    }
    if (callIndex >= tableStubs.length) {
      throw new Error(
        `[Supabase Mock] Table "${table}" received call #${callIndex + 1} ` +
          `but only ${tableStubs.length} response(s) were configured.`,
      );
    }
    return tableStubs[callIndex];
  };

  const supportedSet = new Set<string>(SUPPORTED_METHODS as unknown as string[]);

  const chain: Record<string, unknown> = {};

  chain.then = (
    onFulfilled?: ((value: QueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> => {
    try {
      return Promise.resolve(getResult()).then(onFulfilled, onRejected);
    } catch (e) {
      return Promise.reject(e).then(onFulfilled, onRejected);
    }
  };

  for (const method of SUPPORTED_METHODS) {
    chain[method] = () => chain;
  }

  return new Proxy(chain, {
    get(target, prop: string | symbol) {
      if (typeof prop === "symbol" || prop in target) {
        return target[prop as string];
      }
      if (supportedSet.has(prop)) return target[prop];
      return () => {
        throw new Error(
          `[Supabase Mock] Method "${prop}" is not supported on table "${table}". ` +
            `Supported: ${SUPPORTED_METHODS.join(", ")}. ` +
            `Add it to SUPPORTED_METHODS in __tests__/mocks/supabase.ts if needed.`,
        );
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Exported spy
// ---------------------------------------------------------------------------

export const mockFrom = vi.fn((table: string) => {
  const idx = _callCounters[table] ?? 0;
  _callCounters[table] = idx + 1;
  return makeChain(table, idx);
});

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function resetSupabaseMocks() {
  for (const key of Object.keys(_callCounters)) delete _callCounters[key];
  _stubs = {};
  mockFrom.mockClear();
}

/**
 * Configure response sequences per table. Each entry in the array is returned
 * for the Nth `from(table)` call (0-indexed).
 *
 * @example
 * stubSupabaseTables({
 *   players: [
 *     { data: [], error: null },           // 1st from("players") call
 *     { data: null, error: null },          // 2nd from("players") call
 *   ],
 *   brackets: [
 *     { data: { id: "b1" }, error: null },  // 1st from("brackets") call
 *   ],
 * });
 */
export function stubSupabaseTables(
  config: Record<string, QueryResult[]>,
): void {
  for (const [table, responses] of Object.entries(config)) {
    _stubs[table] = responses;
  }
}

/**
 * Create a standalone thenable chain that resolves to `result`. Useful for
 * one-off overrides or direct assertions outside the table-sequence system.
 */
export function makeSupabaseChain(result: QueryResult) {
  const chain: Record<string, unknown> = {};

  chain.then = (
    onFulfilled?: ((value: QueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> => {
    try {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    } catch (e) {
      return Promise.reject(e).then(onFulfilled, onRejected);
    }
  };

  for (const method of SUPPORTED_METHODS) {
    chain[method] = () => chain;
  }

  return chain;
}

/**
 * Returns how many times `from(table)` has been called since the last reset.
 */
export function getCallCount(table: string): number {
  return _callCounters[table] ?? 0;
}

/**
 * Full list of chain methods the mock supports. Extend this array (and the
 * `SUPPORTED_METHODS` const above) if your app uses additional PostgREST
 * builder methods.
 */
export const supportedChainMethods: readonly SupportedMethod[] =
  SUPPORTED_METHODS;
