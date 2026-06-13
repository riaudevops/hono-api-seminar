import { describe, test, expect } from 'bun:test';
import { APIError } from '../utils/api-error.util';

describe('APIError', () => {
  test('default statusCode is 400', () => {
    const err = new APIError('something went wrong');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('something went wrong');
  });

  test('custom statusCode', () => {
    const err = new APIError('not found', 404);
    expect(err.statusCode).toBe(404);
  });

  test('is instance of Error', () => {
    const err = new APIError('err');
    expect(err).toBeInstanceOf(Error);
  });

  test('details is set when provided', () => {
    const err = new APIError('invalid', 422, { field: 'nim' });
    expect(err.details).toEqual({ field: 'nim' });
  });

  test('details is undefined when not provided', () => {
    const err = new APIError('invalid');
    expect(err.details).toBeUndefined();
  });

  test('message is accessible via .message', () => {
    const err = new APIError('forbidden', 403);
    expect(err.message).toBe('forbidden');
  });

  test('statusCode 409 conflict', () => {
    const err = new APIError('duplicate entry', 409);
    expect(err.statusCode).toBe(409);
  });

  test('statusCode 500 server error', () => {
    const err = new APIError('internal error', 500);
    expect(err.statusCode).toBe(500);
  });

  test('details object with multiple keys', () => {
    const err = new APIError('bad request', 400, { a: 1, b: 'x' });
    expect(err.details?.a).toBe(1);
    expect(err.details?.b).toBe('x');
  });
});
