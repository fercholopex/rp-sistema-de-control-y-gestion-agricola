/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ZONA_HORARIA: process.env.ZONA_HORARIA ?? "America/Mexico_City",
  },
  devIndicators: false,
};

export default nextConfig;
