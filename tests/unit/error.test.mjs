import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  delete globalThis.APIError;
  delete globalThis.NetworkError;
  delete globalThis.TimeoutError;
  delete globalThis.AuthError;
  delete globalThis.ValidationError;
  delete globalThis.RateLimitError;
  delete globalThis.ErrorHandler;
  delete globalThis.createError;
  delete globalThis.formatError;
  delete globalThis.setGlobalErrorHandler;
  delete globalThis.getGlobalErrorHandler;
  loadModule('core/utils/api/error.js');
});

describe('Error classes', () => {
  it('APIError has correct defaults', () => {
    const err = new globalThis.APIError('test');
    expect(err.name).toBe('APIError');
    expect(err.message).toBe('test');
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.details).toBeNull();
    expect(typeof err.timestamp).toBe('number');
  });

  it('APIError accepts custom code and details', () => {
    const err = new globalThis.APIError('custom', 'CUSTOM_CODE', { extra: true });
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.details).toEqual({ extra: true });
  });

  it('NetworkError has NETWORK_ERROR code', () => {
    const err = new globalThis.NetworkError('offline');
    expect(err.name).toBe('NetworkError');
    expect(err.code).toBe('NETWORK_ERROR');
  });

  it('TimeoutError stores timeout value', () => {
    const err = new globalThis.TimeoutError('timed out', 5000);
    expect(err.name).toBe('TimeoutError');
    expect(err.code).toBe('TIMEOUT_ERROR');
    expect(err.timeout).toBe(5000);
  });

  it('AuthError has AUTH_ERROR code', () => {
    const err = new globalThis.AuthError('unauthorized');
    expect(err.code).toBe('AUTH_ERROR');
  });

  it('ValidationError stores fields', () => {
    const err = new globalThis.ValidationError('invalid', { name: 'required' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fields).toEqual({ name: 'required' });
  });

  it('RateLimitError stores retryAfter', () => {
    const err = new globalThis.RateLimitError('too many', 30);
    expect(err.code).toBe('RATE_LIMIT_ERROR');
    expect(err.retryAfter).toBe(30);
  });
});

describe('ErrorHandler.categorize', () => {
  let handler;
  beforeEach(() => { handler = new globalThis.ErrorHandler(); });

  it('returns existing APIError as-is', () => {
    const original = new globalThis.APIError('existing', 'MY_CODE');
    const result = handler.categorize(original);
    expect(result).toBe(original);
  });

  it('classifies TypeError with "Failed to fetch" as NetworkError', () => {
    const err = new TypeError('Failed to fetch');
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.NetworkError);
  });

  it('classifies AbortError as TimeoutError', () => {
    const err = { name: 'AbortError', message: 'The operation was aborted' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.TimeoutError);
  });

  it('classifies status 401 as AuthError', () => {
    const err = { status: 401, message: 'Unauthorized' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.AuthError);
  });

  it('classifies status 403 as AuthError', () => {
    const err = { status: 403, message: 'Forbidden' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.AuthError);
  });

  it('classifies status 400 as ValidationError', () => {
    const err = { status: 400, message: 'Bad Request' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.ValidationError);
  });

  it('classifies status 422 as ValidationError', () => {
    const err = { status: 422, message: 'Unprocessable Entity' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.ValidationError);
  });

  it('classifies status 429 as RateLimitError', () => {
    const err = { status: 429, message: 'Too Many Requests' };
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.RateLimitError);
  });

  it('classifies unknown errors as APIError with UNKNOWN_ERROR', () => {
    const err = new Error('something random');
    const result = handler.categorize(err);
    expect(result).toBeInstanceOf(globalThis.APIError);
    expect(result.code).toBe('UNKNOWN_ERROR');
  });
});

describe('ErrorHandler detection methods', () => {
  let handler;
  beforeEach(() => { handler = new globalThis.ErrorHandler(); });

  it('isNetworkError detects TypeError with Failed to fetch', () => {
    expect(handler.isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('isNetworkError detects ECONNREFUSED', () => {
    expect(handler.isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('isNetworkError returns false for normal errors', () => {
    expect(handler.isNetworkError(new Error('normal'))).toBe(false);
  });

  it('isTimeoutError detects name=AbortError', () => {
    expect(handler.isTimeoutError({ name: 'AbortError' })).toBe(true);
  });

  it('isTimeoutError detects timeout in message', () => {
    expect(handler.isTimeoutError(new Error('timeout occurred'))).toBe(true);
  });

  it('isAuthError detects status 401', () => {
    expect(handler.isAuthError({ status: 401 })).toBe(true);
  });

  it('isAuthError detects Unauthorized message', () => {
    expect(handler.isAuthError(new Error('Unauthorized'))).toBe(true);
  });

  it('isValidationError detects status 400', () => {
    expect(handler.isValidationError({ status: 400 })).toBe(true);
  });

  it('isRateLimitError detects status 429', () => {
    expect(handler.isRateLimitError({ status: 429 })).toBe(true);
  });

  it('handles null/undefined gracefully', () => {
    expect(handler.isNetworkError(null)).toBe(false);
    expect(handler.isTimeoutError(undefined)).toBe(false);
    expect(handler.isAuthError(null)).toBe(false);
    expect(handler.isValidationError(undefined)).toBe(false);
    expect(handler.isRateLimitError(null)).toBe(false);
  });
});

describe('ErrorHandler _shouldRetry', () => {
  it('retries NetworkError when under maxRetries', () => {
    const handler = new globalThis.ErrorHandler({ maxRetries: 3 });
    const err = new globalThis.NetworkError('offline');
    expect(handler._shouldRetry(err, { retryCount: 1 })).toBe(true);
  });

  it('does not retry when retryCount equals maxRetries', () => {
    const handler = new globalThis.ErrorHandler({ maxRetries: 3 });
    const err = new globalThis.NetworkError('offline');
    expect(handler._shouldRetry(err, { retryCount: 3 })).toBe(false);
  });

  it('retries RateLimitError with positive retryAfter', () => {
    const handler = new globalThis.ErrorHandler();
    const err = new globalThis.RateLimitError('limit', 10);
    expect(handler._shouldRetry(err, { retryCount: 0 })).toBe(true);
  });
});

describe('helper functions', () => {
  it('createError returns APIError', () => {
    const err = globalThis.createError('test', 'TEST_CODE');
    expect(err).toBeInstanceOf(globalThis.APIError);
    expect(err.code).toBe('TEST_CODE');
  });

  it('formatError formats APIError with all fields', () => {
    const err = new globalThis.APIError('test', 'CODE', { a: 1 });
    const formatted = globalThis.formatError(err);
    expect(formatted.name).toBe('APIError');
    expect(formatted.code).toBe('CODE');
    expect(formatted.details).toEqual({ a: 1 });
    expect(typeof formatted.timestamp).toBe('number');
  });

  it('formatError handles plain Error', () => {
    const formatted = globalThis.formatError(new Error('plain'));
    expect(formatted.code).toBe('UNKNOWN_ERROR');
    expect(formatted.message).toBe('plain');
  });
});

describe('global error handler', () => {
  it('set/get global error handler', () => {
    const h = new globalThis.ErrorHandler();
    globalThis.setGlobalErrorHandler(h);
    expect(globalThis.getGlobalErrorHandler()).toBe(h);
    globalThis.setGlobalErrorHandler(null);
  });
});
