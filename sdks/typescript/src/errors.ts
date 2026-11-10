/**
 * Custom Error classes for the EpoClaim SDK.
 */

export class EpoClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpoClaimError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimAPIError extends EpoClaimError {
  public readonly statusCode: number;
  public readonly responseBody?: unknown;

  constructor(statusCode: number, message: string, responseBody?: unknown) {
    super(`EpoClaim API Error [HTTP ${statusCode}]: ${message}`);
    this.name = "EpoClaimAPIError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimAuthenticationError extends EpoClaimAPIError {
  constructor(message: string, responseBody?: unknown) {
    super(401, message, responseBody);
    this.name = "EpoClaimAuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimNotFoundError extends EpoClaimAPIError {
  constructor(message: string, responseBody?: unknown) {
    super(404, message, responseBody);
    this.name = "EpoClaimNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimValidationError extends EpoClaimAPIError {
  constructor(message: string, responseBody?: unknown) {
    super(422, message, responseBody);
    this.name = "EpoClaimValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimPayloadTooLargeError extends EpoClaimAPIError {
  constructor(message: string, responseBody?: unknown) {
    super(413, message, responseBody);
    this.name = "EpoClaimPayloadTooLargeError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimTimeoutError extends EpoClaimError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`EpoClaim request timed out after ${timeoutMs}ms.`);
    this.name = "EpoClaimTimeoutError";
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EpoClaimNetworkError extends EpoClaimError {
  public readonly causeError: unknown;

  constructor(message: string, causeError?: unknown) {
    super(`EpoClaim Network Error: ${message}`);
    this.name = "EpoClaimNetworkError";
    this.causeError = causeError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

