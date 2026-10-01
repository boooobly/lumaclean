import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {source: "/admin/:path*", headers: [{key: "X-Robots-Tag", value: "noindex, nofollow, noarchive"}, {key: "Cache-Control", value: "private, no-store"}, {key: "X-Frame-Options", value: "DENY"}, {key: "Referrer-Policy", value: "same-origin"}]},
      {source: "/api/auth/:path*", headers: [{key: "X-Robots-Tag", value: "noindex, nofollow"}, {key: "Cache-Control", value: "private, no-store"}]},
      {source: "/api/admin/:path*", headers: [{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"},{key:"Cache-Control",value:"private, no-store"},{key:"X-Frame-Options",value:"DENY"}]},
      ...(process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_ENV !== "production" && !process.env.VERCEL && process.env.ARTICLES_PREVIEW === "1") ? [{source: "/:path*", headers: [{key: "X-Robots-Tag", value: "noindex, nofollow"}]}] : []),
      {
        source: "/media/journey-v5/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{type: "host", value: "www.lumacleanrs.com"}],
        destination: "https://lumacleanrs.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{type: "host", value: "lumaclean-dusky.vercel.app"}],
        destination: "https://lumacleanrs.com/:path*",
        permanent: true,
      },
      ...["ru", "sr", "en"].map((locale) => ({
        source: `/${locale}/v2`,
        destination: `/${locale}`,
        permanent: true,
      })),
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
