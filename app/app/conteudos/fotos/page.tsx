import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { MEDIA_COLUMNS, type MediaItem } from '@/lib/contentTypes';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { ContentTabs } from '@/components/content/ContentTabs';

export const metadata = { title: 'Fotos e referências · 1loop creators' };

export default async function FotosPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from('media').select(MEDIA_COLUMNS).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false });

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
      <MediaLibrary items={((data ?? []) as unknown as MediaItem[])} />
    </div>
  );
}
