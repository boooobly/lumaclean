import type {NextConfig} from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return ["ru", "sr", "en"].map((locale) => ({
      source: `/${locale}/v2`,
      destination: `/${locale}`,
      permanent: true,
    }));
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
