/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Links curtos para indicação (WhatsApp e LinkedIn), com a origem marcada para o Cockpit.
  async redirects() {
    return [
      { source: '/w', destination: '/vendedores?utm_source=indicacao&utm_medium=whatsapp', permanent: false },
      { source: '/in', destination: '/vendedores?utm_source=indicacao&utm_medium=linkedin', permanent: false },
    ];
  },
  experimental: {
    // fotos já chegam reduzidas pelo navegador (até ~1 MB), com folga
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
