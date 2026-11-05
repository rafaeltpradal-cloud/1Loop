import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { MEDIA_COLUMNS, type MediaItem } from '@/lib/contentTypes';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { ContentTabs } from '@/components/content/ContentTabs';
import { BrandVisualRefresh } from '@/components/content/BrandVisual';
import type { Strategy } from '@/lib/strategy';

export const metadata = { title: 'Fotos e referências · 1loop creators' };

export default async function FotosPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data }, { data: strategyRow }] = await Promise.all([
    supabase.from('media').select(MEDIA_COLUMNS).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }),
    supabase.from('strategies').select('data').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const strategy = strategyRow?.data as Strategy | undefined;

  return (
    <div className="page">
      <div className="pageHead">
        <div className="eyebrow">Conteúdos</div>
        <h1 className="pageTitle">
          <span className="graphite">Fotos e</span> <span className="grad">referências.</span>
        </h1>
        <span className="pageSub">Fotos entram nos posts. Referências inspiram o estilo.</span>
      </div>
      <ContentTabs active="fotos" />
      {strategy && !strategy.modelo?.estilo && <BrandVisualRefresh visual={strategy.visual ?? null} />}
      <MediaLibrary items={((data ?? []) as unknown as MediaItem[])} />
    </div>
  );
}
