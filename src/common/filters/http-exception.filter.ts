import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // a non-Nest error (e.g. body-parser's PayloadTooLargeError) still carries a
    // real HTTP status via `status`/`statusCode`; honor it instead of flattening
    // every non-HttpException into a 500
    const rawStatus = (exception as { status?: unknown; statusCode?: unknown })
      ?.status ?? (exception as { statusCode?: unknown })?.statusCode;
    const isClientError =
      typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 500;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isClientError
          ? rawStatus
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? ((exceptionResponse as Record<string, unknown>).message ??
          exceptionResponse)
        : exception instanceof HttpException
          ? exception.message
          : isClientError
            ? 'Bad request'
            : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      message,
    });
  }
}
