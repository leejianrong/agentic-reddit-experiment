export class RedditApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'RedditApiError';
    this.status = status;
    this.body = body;
  }
}
