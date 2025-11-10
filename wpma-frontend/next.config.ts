/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone for now to use standard next start
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
