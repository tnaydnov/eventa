/**
 * Shared Supabase / PostgREST query-builder mock for unit & integration tests.
 *
 * The real `@supabase/supabase-js` query builder is a long, fluent chain
 * (`from().select().eq().is().order().limit()` …) that is *thenable* — you can
 * `await` it at any point — and also exposes terminal resolvers `.single()` /
 * `.maybeSingle()`. Hand-rolled per-test mocks tend to implement only the exact
 * methods a route used at the time, so they break the moment a route adds another
 * filter (e.g. the soft-delete `.is('deleted_at', null)` guard). That brittleness
 * is the root cause of most "X is not a function" / cascading-500 test failures.
 *
 * `createQueryMock` returns a single object where:
 *   • every filter/modifier method (eq, neq, is, in, or, order, limit, …) returns
 *     the same builder, so any chain order/length works;
 *   • the builder is awaitable and resolves to `result` (for `await query`);
 *   • `.single()` / `.maybeSingle()` resolve to `result`.
 *
 * This mirrors the real builder's shape, so tests stay green when routes add
 * filters, and we keep one definition instead of duplicating chains everywhere.
 */
import { vi } from 'vitest';

/** Terminal result shape returned by a PostgREST query. */
export interface QueryResult<T = unknown> {
  data: T;
  error: unknown;
  count?: number | null;
}

/** PostgREST builder methods that return the builder itself (chainable). */
const CHAIN_METHODS = [
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
  'range', 'overlaps', 'textSearch', 'match', 'not', 'or', 'filter',
  'order', 'limit', 'returns', 'abortSignal', 'csv', 'geojson', 'explain',
] as const;

/** A chainable, awaitable query-builder mock. */
export type QueryMock = Record<string, ReturnType<typeof vi.fn>> & PromiseLike<QueryResult>;

/**
 * Create a chainable, awaitable Supabase query-builder mock that resolves to `result`.
 *
 * @param result terminal `{ data, error, count? }` the chain resolves to.
 */
export function createQueryMock<T = unknown>(
  result: QueryResult<T> = { data: null as unknown as T, error: null },
): QueryMock {
  const builder = {} as QueryMock;

  // Every chain method returns the same builder so any order/length works.
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }

  // Terminal resolvers.
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);

  // Make the builder awaitable (e.g. `await supabase.from().select().eq(...)`).
  builder.then = ((onFulfilled: ((v: QueryResult<T>) => unknown) | null, onRejected?: ((r: unknown) => unknown) | null) =>
    Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined)) as unknown as ReturnType<typeof vi.fn>;

  return builder;
}

/**
 * Build a `from()` mock that returns a fresh {@link createQueryMock} for each call,
 * pulling results from `queue` in order (falling back to `fallback` when drained).
 * Useful for routes that issue several independent queries.
 */
export function createFromMock(
  queue: QueryResult[] = [],
  fallback: QueryResult = { data: null, error: null },
): ReturnType<typeof vi.fn> {
  const results = [...queue];
  return vi.fn(() => createQueryMock(results.shift() ?? fallback));
}
