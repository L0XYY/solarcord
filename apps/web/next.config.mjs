/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared workspace package (TS source) directly.
  transpilePackages: ["@solarcord/shared"],
};

export default nextConfig;
