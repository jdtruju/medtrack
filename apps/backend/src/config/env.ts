import 'dotenv/config';

function parseCorsOrigins(raw: string | undefined): string[] {
  const valor = raw ?? 'http://localhost:5173';
  return valor
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  emailProvider: process.env.EMAIL_PROVIDER ?? 'mock',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFrom: process.env.RESEND_FROM ?? 'MedTrack <onboarding@resend.dev>',
};
