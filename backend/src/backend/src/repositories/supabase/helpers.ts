import type { SupabaseClient } from "@supabase/supabase-js";

export async function expectOne<T>(
  query: Promise<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function expectMany<T>(
  query: Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function buildScheduleDateRange(date: string): { start: string; end: string } {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  return { start, end };
}

export function mapCount<T>(rows: T[] | null | undefined): number {
  return Array.isArray(rows) ? rows.length : 0;
}

export type DbClient = SupabaseClient;
