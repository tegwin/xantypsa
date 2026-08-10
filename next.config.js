/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next build` both write to .next and overwrite each other's
  // chunks, which breaks a running dev server with "Cannot find module
  // './1234.js'". Setting NEXT_BUILD_DIR sends a verification build somewhere
  // else so it can run while dev stays up — see `npm run build:check`.
  distDir: process.env.NEXT_BUILD_DIR || '.next',

  // Emit a self-contained server bundle for the container image. Without this
  // the runtime image needs the whole node_modules tree — several hundred MB
  // instead of tens.
  output: 'standalone',

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
