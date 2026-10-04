// One normalized origin for metadata, structured data and discovery files.
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://lumacleanrs.com",
).origin;
