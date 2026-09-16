import type { ServiceErrorCode, ServiceErrorShape } from "@tsuki/shared";

/**
 * Every refusal the service layer makes is one of these. Both the slash
 * command adapter and the HTTP adapter render it, so a rule states its reason
 * once and both surfaces say the same thing.
 */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ServiceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.details = details;
  }

  toJSON(): ServiceErrorShape {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

/** HTTP status for the dashboard; Discord only needs the message. */
export function statusForCode(code: ServiceErrorCode): number {
  switch (code) {
    case "NOT_IN_VOICE":
    case "WRONG_VOICE_CHANNEL":
    case "INVALID_INPUT":
    case "SOURCE_UNSUPPORTED":
    case "HOST_NOT_ALLOWED":
      return 400;
    case "DJ_REQUIRED":
    case "CHANNEL_LOCKED":
    case "REQUESTS_DISABLED":
      return 403;
    case "NOT_FOUND":
    case "NOTHING_PLAYING":
    case "QUEUE_EMPTY":
    case "NO_NODE_CONFIGURED":
      return 404;
    case "NO_NODE_AVAILABLE":
    case "NODE_UNREACHABLE":
      return 503;
    case "INTERNAL":
      return 500;
  }
}
