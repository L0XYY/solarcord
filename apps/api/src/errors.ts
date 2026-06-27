export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class ApiError extends Error {
  code: ErrorCode;
  statusCode: number;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.statusCode = STATUS[code];
  }
}

export const Errors = {
  unauthorized: (m = "Authentication required") => new ApiError("UNAUTHORIZED", m),
  forbidden: (m = "You don't have permission to do that") => new ApiError("FORBIDDEN", m),
  notFound: (m = "Not found") => new ApiError("NOT_FOUND", m),
  validation: (m = "Invalid input") => new ApiError("VALIDATION", m),
  conflict: (m = "Already exists") => new ApiError("CONFLICT", m),
};
