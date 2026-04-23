import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { User } from "@supabase/supabase-js";

export interface AuthenticatedRequest extends Request {
  authUser?: User;
  authRole?: string;
}

export type RequireRole = (allowedRoles: string[]) => RequestHandler;
