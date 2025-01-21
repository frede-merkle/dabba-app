import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

interface ProcessingError extends Error {
  code: string;
  context?: unknown;
}

export function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APYHUB_TOKEN'];
  const missing = required.filter(key => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function initSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export function createError(code: string, message: string, context?: unknown): ProcessingError {
  const error = new Error(message) as ProcessingError;
  error.code = code;
  error.context = context;
  return error;
}

export function createResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
