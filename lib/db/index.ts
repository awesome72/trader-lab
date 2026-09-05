import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server Components / Route Handlers / Server Actions only (CLAUDE.md rule 4).
// This connects with the plain Postgres role, not through Supabase's
// PostgREST layer, so RLS's auth.uid() does NOT resolve here. RLS still
// guards any access via the Supabase client (supabase-js) as defense in
// depth, but every query written against `db` must explicitly filter by the
// authenticated user's id obtained from lib/supabase/server.ts.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
