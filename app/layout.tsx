import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Copiloto Preventivo de Liquidez',
  description: 'Demonstração conceitual e interativa de previsão e resolução de déficits de caixa.',
  openGraph: {
    title: 'Copiloto Preventivo de Liquidez',
    description: 'Veja quando o dinheiro pode faltar — e resolva antes.',
    images: ['/og.png'],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Copiloto Preventivo de Liquidez',
    description: 'Veja quando o dinheiro pode faltar — e resolva antes.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
