export class APIError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
