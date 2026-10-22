import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { LoopDefs } from '@/components/Logo';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: '1loop creators',
  description: 'Conteúdo com estratégia. Redes com resultado.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>
        <LoopDefs />
        {children}
      </body>
    </html>
  );
}
