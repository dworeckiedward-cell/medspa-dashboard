/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from common logo hosting providers
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'revivemedspa.ca', pathname: '/wp-content/uploads/**' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Expose app domain to middleware (Edge Runtime reads process.env via this)
  env: {
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'yourdomain.com',
  },
}

export default nextConfig
