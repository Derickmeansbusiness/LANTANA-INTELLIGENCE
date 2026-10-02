import type { NextConfig } from "next";

/**
 * On Vercel, fall back to the hosted Supabase project when the public
 * variables weren't set in the dashboard. Both values are public by design
 * (every browser receives them); the service-role key is never used. Local
 * development is unaffected and still reads .env.local.
 */
const onVercel = Boolean(process.env.VERCEL);
const HOSTED_SUPABASE_URL = "https://adrurfecdiobvyqdnalq.supabase.co";
const HOSTED_PUBLISHABLE_KEY = "sb_publishable_EBrS93TfJqT9Xn32HRGLuw_M1_DWIgk";

const env: Record<string, string> = {};
if (onVercel) {
  env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || HOSTED_SUPABASE_URL;
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || HOSTED_PUBLISHABLE_KEY;
  // Magic links must come back to this deployment's production address.
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!process.env.NEXT_PUBLIC_SITE_URL && prod) env.NEXT_PUBLIC_SITE_URL = `https://${prod}`;
}

const nextConfig: NextConfig = { env };

export default nextConfig;
