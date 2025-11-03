/**
 * Result type for functional error handling
 * Inspired by Rust's Result<T, E> and functional programming patterns
 *
 * Instead of throwing exceptions, functions return Result objects that can be:
 * - Result.ok(value) - Success case with a value
 * - Result.err(error) - Failure case with an error
 *
 * Benefits:
 * - Explicit error handling (no surprise exceptions)
 * - Composable with map/flatMap
 * - Type-safe error propagation
 */

/**
 * Result class representing either success or failure
 */
export class Result {
  /**
   * @param {boolean} success - True if ok, false if err
   * @param {*} value - The success value or error
   */
  constructor(success, value) {
    this.success = success;
    this.value = value;
  }

  /**
   * Create a successful result
   * @param {*} value - The success value
   * @returns {Result} - Result instance
   */
  static ok(value) {
    return new Result(true, value);
  }

  /**
   * Create a failed result
   * @param {Error|string} error - The error
   * @returns {Result} - Result instance
   */
  static err(error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return new Result(false, errorObj);
  }

  /**
   * Check if result is ok
   * @returns {boolean}
   */
  isOk() {
    return this.success;
  }

  /**
   * Check if result is error
   * @returns {boolean}
   */
  isErr() {
    return !this.success;
  }

  /**
   * Get the value (throws if error)
   * @returns {*}
   * @throws {Error} - If result is error
   */
  unwrap() {
    if (this.isErr()) {
      throw this.value;
    }
    return this.value;
  }

  /**
   * Get the value or a default
   * @param {*} defaultValue - Default value if error
   * @returns {*}
   */
  unwrapOr(defaultValue) {
    return this.isOk() ? this.value : defaultValue;
  }

  /**
   * Get the error (returns null if ok)
   * @returns {Error|null}
   */
  getError() {
    return this.isErr() ? this.value : null;
  }

  /**
   * Map the success value
   * @param {Function} fn - Transform function
   * @returns {Result}
   */
  map(fn) {
    if (this.isErr()) {
      return this;
    }
    try {
      return Result.ok(fn(this.value));
    } catch (error) {
      return Result.err(error);
    }
  }

  /**
   * FlatMap for chaining operations that return Results
   * @param {Function} fn - Function that returns a Result
   * @returns {Result}
   */
  flatMap(fn) {
    if (this.isErr()) {
      return this;
    }
    try {
      return fn(this.value);
    } catch (error) {
      return Result.err(error);
    }
  }

  /**
   * Execute a function on error case
   * @param {Function} fn - Function to handle error
   * @returns {Result}
   */
  mapErr(fn) {
    if (this.isOk()) {
      return this;
    }
    return Result.err(fn(this.value));
  }

  /**
   * Match pattern for exhaustive handling
   * @param {Object} matchers - { ok: fn, err: fn }
   * @returns {*}
   */
  match(matchers) {
    if (this.isOk()) {
      return matchers.ok(this.value);
    }
    return matchers.err(this.value);
  }
}

/**
 * Wrap a function that might throw into a Result-returning function
 * @param {Function} fn - Function that might throw
 * @returns {Function} - Function that returns Result
 */
export function tryFn(fn) {
  return function(...args) {
    try {
      const result = fn.apply(this, args);
      return Result.ok(result);
    } catch (error) {
      return Result.err(error);
    }
  };
}

/**
 * Execute an async function and return a Result
 * @param {Function} asyncFn - Async function
 * @returns {Promise<Result>}
 */
export async function tryAsync(asyncFn) {
  try {
    const result = await asyncFn();
    return Result.ok(result);
  } catch (error) {
    return Result.err(error);
  }
}

/**
 * Combine multiple Results into one
 * Returns ok with array of values if all ok, otherwise first error
 * @param {Array<Result>} results - Array of Results
 * @returns {Result}
 */
export function combineResults(results) {
  const values = [];

  for (const result of results) {
    if (result.isErr()) {
      return result;
    }
    values.push(result.value);
  }

  return Result.ok(values);
}
