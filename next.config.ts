import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** The short-link domain shown in the UI (monitr.link). */
const linkHost = process.env.NEXT_PUBLIC_LINK_HOST || "monitr.link";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // When the short-link domain is pointed at this service, monitr.link/<venue>/<channel>
  // is served by the tracked-link redirect. Until then links resolve through /r/….
  async rewrites() {
    return { beforeFiles: [{ source: "/:venue/:path+", has: [{ type: "host", value: linkHost }], destination: "/r/:venue/:path+" }] };
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
