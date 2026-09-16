import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that any unhandled promise rejection
 * is forwarded to Express's next(err) error middleware instead of
 * crashing the Node.js process.
 */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
