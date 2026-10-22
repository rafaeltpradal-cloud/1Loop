import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { MEDIA_COLUMNS, type MediaItem } from '@/lib/contentTypes';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { ContentTabs } from '@/components/content/ContentTabs';

export const metadata = { title: 'Fotos e referências · 1loop creators' };

export default async function FotosPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from('media').select(MEDIA_COLUMNS).eq('user_id', ctx.userId).order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1180 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Conteúdos</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
          <span className="graphite">Suas fotos e</span> <span className="grad">referências.</span>
        </h1>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 720 }}>
          <b>Fotos</b> entram nos posts: viram o fundo das imagens e a IA escreve o texto olhando para elas. <b>Referências</b> são posts que você admira; a IA se inspira no estilo, sem copiar.
        </span>
      </div>
      <ContentTabs active="fotos" />
      <MediaLibrary items={((data ?? []) as unknown as MediaItem[])} />
    </div>
  );
}
