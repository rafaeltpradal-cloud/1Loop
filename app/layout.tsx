import type { Metadata } from 'next';
import { Anton, JetBrains_Mono, Manrope, Playfair_Display, Space_Grotesk } from 'next/font/google';
import { LoopDefs } from '@/components/Logo';
import { THEME_SCRIPT } from '@/lib/theme';
import { Tracking } from '@/components/Tracking';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
// Fontes das imagens dos posts (identidade visual de cada pessoa, lib/visual.ts). Sem preload: só baixam quando uma imagem usa.
const serif = Playfair_Display({ subsets: ['latin'], variable: '--font-serif', display: 'swap', preload: false, weight: ['600', '700', '800'] });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', display: 'swap', preload: false, weight: ['500', '600', '700'] });
const display = Anton({ subsets: ['latin'], variable: '--font-display', display: 'swap', preload: false, weight: '400' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false, weight: ['500', '700', '800'] });

export const metadata: Metadata = {
  title: '1loop creators',
  description: 'Conteúdo com estratégia. Redes com resultado.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${serif.variable} ${grotesk.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <LoopDefs />
        {children}
        <Tracking />
      </body>
    </html>
  );
}
