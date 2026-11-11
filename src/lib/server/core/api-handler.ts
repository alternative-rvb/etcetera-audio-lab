import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { ApiErrorBody } from "@/lib/shared/types";
import { AppError, toAppError } from "./errors";
import { createLogger, writeLog } from "./logger";
import { resolveRequestId, runWithRequestContext } from "./request-context";

// SECTION: Enveloppe commune de toutes les routes API : requestId, chronométrage, logs, erreurs normalisées.

const apiLogger = createLogger("api");

export interface ApiHandlerContext<TParams> {
  requestId: string;
  params: TParams;
}

type RouteSegmentContext<TParams> = { params: Promise<TParams> };

export function withApiHandler<TParams = Record<string, never>>(
  routeName: string,
  handler: (request: NextRequest, context: ApiHandlerContext<TParams>) => Promise<Response>,
  options: { quiet?: boolean } = {}
) {
  return async (request: NextRequest, segmentContext: RouteSegmentContext<TParams>): Promise<Response> => {
    const requestId = resolveRequestId(request.headers.get("X-Request-Id"));
    const startedAt = performance.now();
    const route = `${request.method} ${routeName}`;

    return runWithRequestContext({ requestId, route }, async () => {
      if (!options.quiet) apiLogger.debug("request.start", route);
      try {
        const params = (await segmentContext?.params) ?? ({} as TParams);
        const response = await handler(request, { requestId, params });
        response.headers.set("X-Request-Id", requestId);
        if (!options.quiet) {
          apiLogger.info("request.end", `${route} → ${response.status}`, {
            durationMs: Math.round(performance.now() - startedAt),
            meta: { status: response.status },
          });
        }
        return response;
      } catch (err) {
        const appError = toAppError(err);
        const durationMs = Math.round(performance.now() - startedAt);
        writeLog({
          level: appError.status >= 500 ? "error" : "warn",
          source: appError.provider ?? "api",
          event: `error.${appError.code.toLowerCase()}`,
          message: `${route} : ${appError.message}`,
          durationMs,
          meta: { status: appError.status, hint: appError.hint, details: appError.details },
          error: appError.cause ?? appError,
        });
        return errorResponse(appError, requestId);
      }
    });
  };
}

export function errorResponse(error: AppError, requestId: string): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      hint: error.hint,
      provider: error.provider,
      requestId,
      details: error.details,
    },
  };
  return NextResponse.json(body, { status: error.status, headers: { "X-Request-Id": requestId } });
}

/** Lit et valide un corps JSON. Un JSON illisible devient une erreur VALIDATION explicite. */
export async function parseJsonBody<TSchema extends z.ZodType>(request: Request, schema: TSchema): Promise<z.infer<TSchema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (err) {
    throw new AppError("VALIDATION", "Le corps de la requête n'est pas un JSON valide.", { cause: err });
  }
  return schema.parse(raw);
}

export function requireFound<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new AppError("NOT_FOUND", `${what} introuvable.`);
  }
  return value;
}
