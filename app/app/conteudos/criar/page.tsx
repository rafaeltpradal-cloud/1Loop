import Link from 'next/link';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { MEDIA_COLUMNS, type MediaItem } from '@/lib/contentTypes';
import { CreatePost } from './CreatePost';
import type { Slot } from '../novo/StoryPost';

export const metadata = { title: 'Crie seu post · 1loop creators' };

// "Crie seu post": a pessoa monta o post do zero (foto + legenda) com uma barra de IA para pedir o que quiser.
export default async function CriarPostPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data: strategyRow }, { data: media }] = await Promise.all([
    supabase.from('strategies').select('id, data, created_at').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('media').select(MEDIA_COLUMNS).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }),
  ]);

  if (!strategyRow) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Crie seu post</div>
        <h1 className="pageTitle"><span className="graphite">Primeiro a estratégia.</span></h1>
        <p className="pageSub">O post entra no calendário do seu mês. Termine a entrevista para ele existir.</p>
        <div><Link className="btn3d" href="/app/entrevista">Ir para a entrevista</Link></div>
      </div>
    );
  }

  const strategy = strategyRow.data as Strategy;
  const start = planStartFrom(strategyRow.created_at as string);
  const today = isoInBrazil();
  const { data: posts } = await supabase.from('posts').select('item_index').eq('strategy_id', strategyRow.id).eq('user_id', ctx.userId);
  const used = new Set((posts ?? []).map((p) => p.item_index as number));
  const slots: Slot[] = strategy.calendario
    .map((it, index) => ({ index, date: itemDate(it, start), rede: it.rede, formato: it.formato, tema: it.tema }))
    .filter((s) => !used.has(s.index) && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="pageHead">
        <div className="eyebrow">Crie seu post</div>
        <h1 className="pageTitle">
          <span className="graphite">Do seu jeito,</span> <span className="grad">do zero.</span>
        </h1>
        <p className="pageSub">Coloque a sua foto, escreva a legenda ou peça para a IA: “a partir desta foto, conta que fechei o maior contrato do ano”.</p>
      </div>
      <CreatePost
        slots={slots}
        media={((media ?? []) as MediaItem[]).filter((m) => m.kind !== 'video')}
        preview={ctx.preview}
        author={{ name: ctx.name || 'Você', avatar: ctx.avatarUrl }}
      />
    </div>
  );
}
