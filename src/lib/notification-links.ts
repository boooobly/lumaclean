/** Manager links must stay on the deployment that owns the notification's data. */
export function managerLink(path:string){
  const base=process.env.VERCEL_ENV==='preview'
    ? process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null
    : process.env.NEXT_PUBLIC_SITE_URL??'https://lumacleanrs.com';
  if(!base)throw new Error('PREVIEW_NOTIFICATION_ORIGIN_UNCONFIGURED');
  return new URL(path,base).href;
}
