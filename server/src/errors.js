/**
 * 以 API 合約的錯誤碼拋出的 HTTP 錯誤。由 app.js 的 error handler
 * 轉成 { error, message }。
 */
export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message ?? code);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = code;
  }
}

export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'not_found', message);

export const validationError = (message) =>
  new ApiError(400, 'validation_error', message);
