import { GoogleRoutesProvider } from "./google-routing";
import { MotisRoutingProvider } from "./motis-routing";
import type { RoutingProvider } from "@/lib/domain/routing";
export const motisSelected = () =>
  process.env.LUMACLEAN_ROUTING_PROVIDER !== "GOOGLE";
let motis:
  | {
      url: string | undefined;
      token: string | undefined;
      provider: MotisRoutingProvider;
    }
  | undefined;
export function routingProvider(): RoutingProvider {
  if (
    !motisSelected() &&
    process.env.LUMACLEAN_GOOGLE_ROUTING_ENABLED === "true"
  )
    return new GoogleRoutesProvider();
  const url = process.env.LUMACLEAN_ROUTING_URL,
    token = process.env.LUMACLEAN_ROUTING_TOKEN;
  if (!motis || motis.url !== url || motis.token !== token)
    motis = { url, token, provider: new MotisRoutingProvider(url, token) };
  return motis.provider;
}
