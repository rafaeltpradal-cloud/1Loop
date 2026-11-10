// MCP com o token no próprio link (para conectores que só aceitam uma URL, como o Claude e o ChatGPT). Ver lib/mcp.ts.
import { mcpGet, mcpOptions, mcpPost } from '@/lib/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return mcpPost(req, token);
}
export const GET = () => mcpGet();
export const DELETE = () => new Response(null, { status: 204 });
export const OPTIONS = () => mcpOptions();
