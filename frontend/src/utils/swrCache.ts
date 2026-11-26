/**
 * Lightweight in-memory Stale-While-Revalidate (SWR) cache with in-flight request
 * deduplication so navigating across workspace views renders cached data instantly.
 */

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const swrCache = {
  get<T>(key: string): T | undefined {
    return store.get(key)?.data as T | undefined;
  },

  isFresh(key: string, staleMs = 15_000): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    return Date.now() - entry.updatedAt < staleMs;
  },

  set<T>(key: string, data: T): T {
    store.set(key, { data, updatedAt: Date.now() });
    return data;
  },

  invalidate(prefix: string): void {
    for (const key of store.keys()) {
      if (key === prefix || key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  },

  clear(): void {
    store.clear();
    inflight.clear();
  },

  async fetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = fetcher()
      .then((data) => {
        store.set(key, { data, updatedAt: Date.now() });
        return data;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  },

  prefetch<T>(key: string, fetcher: () => Promise<T>, staleMs = 20_000): void {
    if (this.isFresh(key, staleMs) || inflight.has(key)) return;
    void this.fetch(key, fetcher).catch(() => {
      // Best-effort hover prefetch should never surface unhandled errors
    });
  },
};
