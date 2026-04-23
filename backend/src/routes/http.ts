import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return function wrapped(req, res, next) {
    handler(req, res, next).catch(next);
  };
}

export function badRequest(res: Response, error: string, details?: unknown): void {
  res.status(400).json({ error, details: details ?? null });
}

export function notFound(res: Response, error: string): void {
  res.status(404).json({ error });
}

export function ok<T>(res: Response, data: T): void {
  res.status(200).json(data);
}
