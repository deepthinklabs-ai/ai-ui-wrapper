/**
 * Parallel Processing Utility
 *
 * Provides controlled concurrency for processing multiple items in parallel.
 * Used by the SSM cron job to process multiple nodes efficiently while
 * respecting API rate limits and memory constraints.
 *
 * @example
 * // Process 100 items, 20 at a time
 * const results = await processInParallel(items, processItem, { concurrency: 20 });
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ParallelProcessOptions {
  /**
   * Maximum number of items to process simultaneously.
   * Higher = faster but more resource intensive and may hit rate limits.
   * Recommended: 10-25 for API calls.
   * @default 20
   */
  concurrency: number;

  /**
   * Whether to continue processing remaining items if one fails.
   * @default true
   */
  continueOnError?: boolean;

  /**
   * Optional label for logging (helps with debugging)
   */
  label?: string;
}

export interface ParallelProcessResult<T> {
  /** Successfully processed results */
  successes: T[];

  /** Errors that occurred during processing */
  errors: Array<{
    index: number;
    error: string;
  }>;

  /** Total items processed (success + failure) */
  totalProcessed: number;

  /** Processing duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Process items in parallel with controlled concurrency.
 *
 * Instead of processing all items at once (which could overwhelm APIs)
 * or one at a time (which is too slow), this processes items in batches.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Concurrency and error handling options
 * @returns Results including successes, errors, and timing
 */
export async function processInParallel<TItem, TResult>(
  items: TItem[],
  processor: (item: TItem, index: number) => Promise<TResult>,
  options: ParallelProcessOptions
): Promise<ParallelProcessResult<TResult>> {
  const startTime = Date.now();
  const { concurrency, continueOnError = true, label = 'items' } = options;

  const result: ParallelProcessResult<TResult> = {
    successes: [],
    errors: [],
    totalProcessed: 0,
    durationMs: 0,
  };

  if (items.length === 0) {
    result.durationMs = Date.now() - startTime;
    return result;
  }

  console.log(`[Parallel] Starting: ${items.length} ${label}, concurrency: ${concurrency}`);

  // Process items in batches
  const batches = chunkArray(items, concurrency);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartIndex = batchIndex * concurrency;

    console.log(
      `[Parallel] Batch ${batchIndex + 1}/${batches.length}: ` +
      `processing ${batch.length} ${label}`
    );

    // Process all items in this batch simultaneously
    const batchPromises = batch.map(async (item, indexInBatch) => {
      const globalIndex = batchStartIndex + indexInBatch;

      try {
        const itemResult = await processor(item, globalIndex);
        return { success: true as const, result: itemResult, index: globalIndex };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false as const, error: errorMsg, index: globalIndex };
      }
    });

    // Wait for all items in batch to complete
    const batchResults = await Promise.all(batchPromises);

    // Collect results
    for (const batchResult of batchResults) {
      result.totalProcessed++;

      if (batchResult.success) {
        result.successes.push(batchResult.result);
      } else {
        result.errors.push({
          index: batchResult.index,
          error: batchResult.error,
        });

        if (!continueOnError) {
          console.log(`[Parallel] Stopping early due to error at index ${batchResult.index}`);
          result.durationMs = Date.now() - startTime;
          return result;
        }
      }
    }
  }

  result.durationMs = Date.now() - startTime;

  console.log(
    `[Parallel] Complete: ${result.successes.length} succeeded, ` +
    `${result.errors.length} failed, ${result.durationMs}ms`
  );

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Split an array into chunks of specified size.
 *
 * @example
 * chunkArray([1,2,3,4,5], 2) => [[1,2], [3,4], [5]]
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Process items with default concurrency (20).
 * Convenience wrapper for common use case.
 */
export async function processInParallelDefault<TItem, TResult>(
  items: TItem[],
  processor: (item: TItem, index: number) => Promise<TResult>,
  label?: string
): Promise<ParallelProcessResult<TResult>> {
  return processInParallel(items, processor, {
    concurrency: 20,
    continueOnError: true,
    label,
  });
}
