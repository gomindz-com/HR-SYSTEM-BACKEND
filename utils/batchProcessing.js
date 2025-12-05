/**
 * Process items in batches with controlled concurrency
 * This helps prevent overwhelming external services (like email providers)
 * with too many simultaneous requests
 * 
 * @param {Array} items - Array of items to process
 * @param {Number} batchSize - Number of items to process concurrently (default: 5)
 * @param {Function} processFn - Async function to process each item
 * @param {Number} delayBetweenBatches - Delay in ms between batches (default: 100ms)
 * @returns {Promise<Object>} Object with results, successCount, and failureCount
 */
export const processBatch = async (
  items,
  batchSize = 5,
  processFn,
  delayBetweenBatches = 100
) => {
  const results = {
    successful: [],
    failed: [],
    successCount: 0,
    failureCount: 0,
  };

  // Validate inputs
  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }

  if (typeof processFn !== "function") {
    throw new Error("processFn must be a function");
  }

  if (items.length === 0) {
    return results;
  }

  console.log(
    `📦 Starting batch processing: ${items.length} items in batches of ${batchSize}`
  );

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);

    console.log(
      `⚙️  Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`
    );

    // Process all items in current batch concurrently
    const batchPromises = batch.map(async (item, index) => {
      try {
        const result = await processFn(item, i + index);
        results.successful.push({
          item,
          result,
          index: i + index,
        });
        results.successCount++;
        return { success: true, item, result };
      } catch (error) {
        console.error(
          `❌ Error processing item at index ${i + index}:`,
          error.message
        );
        results.failed.push({
          item,
          error: error.message,
          index: i + index,
        });
        results.failureCount++;
        return { success: false, item, error: error.message };
      }
    });

    // Wait for all items in batch to complete
    await Promise.all(batchPromises);

    console.log(
      `✅ Batch ${batchNumber}/${totalBatches} completed (Success: ${results.successCount}, Failed: ${results.failureCount})`
    );

    // Add small delay between batches to avoid rate limiting
    // Skip delay for last batch
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(
    `🎉 Batch processing completed: ${results.successCount} successful, ${results.failureCount} failed`
  );

  return results;
};

/**
 * Process items sequentially (one at a time)
 * Use when order matters or when you need guaranteed sequential processing
 * 
 * @param {Array} items - Array of items to process
 * @param {Function} processFn - Async function to process each item
 * @returns {Promise<Object>} Object with results, successCount, and failureCount
 */
export const processSequential = async (items, processFn) => {
  const results = {
    successful: [],
    failed: [],
    successCount: 0,
    failureCount: 0,
  };

  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }

  if (typeof processFn !== "function") {
    throw new Error("processFn must be a function");
  }

  if (items.length === 0) {
    return results;
  }

  console.log(`📦 Starting sequential processing: ${items.length} items`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const result = await processFn(item, i);
      results.successful.push({
        item,
        result,
        index: i,
      });
      results.successCount++;
      console.log(`✅ Item ${i + 1}/${items.length} processed successfully`);
    } catch (error) {
      console.error(`❌ Error processing item ${i + 1}/${items.length}:`, error.message);
      results.failed.push({
        item,
        error: error.message,
        index: i,
      });
      results.failureCount++;
    }
  }

  console.log(
    `🎉 Sequential processing completed: ${results.successCount} successful, ${results.failureCount} failed`
  );

  return results;
};

/**
 * Retry a failed operation with exponential backoff
 * 
 * @param {Function} operation - Async function to retry
 * @param {Number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {Number} initialDelay - Initial delay in ms (default: 1000ms)
 * @returns {Promise} Result of the operation
 */
export const retryWithBackoff = async (
  operation,
  maxRetries = 3,
  initialDelay = 1000
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(
          `⚠️  Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`
  );
};

