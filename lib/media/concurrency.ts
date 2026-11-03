// ============================================================
// Run async work with a cap on how many run at once — PURE
// ============================================================
// Decoding a 25 MB photo takes real memory. 20 at once in one request could
// exhaust a serverless function, so complete handles a few at a time.
// Results keep the input order.
// ============================================================

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
