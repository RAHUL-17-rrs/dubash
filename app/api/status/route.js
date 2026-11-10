import { provider } from '@/lib/llm';

export const dynamic = 'force-dynamic';

// Which providers are configured. Booleans and names only, never keys.
export function GET() {
  return Response.json({ gnani: Boolean(process.env.GNANI_API_KEY), llm: provider() });
}
