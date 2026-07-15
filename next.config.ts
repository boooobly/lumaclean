import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
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
