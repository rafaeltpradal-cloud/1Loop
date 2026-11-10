// MCP (Claude, ChatGPT, Cursor…): token no cabeçalho Authorization: Bearer. Ver lib/mcp.ts.
import { mcpGet, mcpOptions, mcpPost } from '@/lib/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = (req: Request) => mcpPost(req);
export const GET = () => mcpGet();
export const DELETE = () => new Response(null, { status: 204 });
export const OPTIONS = () => mcpOptions();
