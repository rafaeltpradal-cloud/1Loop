/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // fotos já chegam reduzidas pelo navegador (até ~1 MB), com folga
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
