import { GoogleRoutesProvider } from "./google-routing";
import { MotisRoutingProvider } from "./motis-routing";
import type { RoutingProvider } from "@/lib/domain/routing";
import { HybridRoutingProvider } from "./hybrid-routing";
import { BusMapsTransitProvider, busMapsMonthlyLimit } from "./busmaps-transit";
import { busMapsAccess } from "./busmaps-status";
import { PrismaBusMapsStore } from "@/lib/services/busmaps-store";
import { fallbackTravelMinutes } from "@/lib/domain/routing-policy";
export const motisSelected = () =>
  process.env.LUMACLEAN_ROUTING_PROVIDER !== "GOOGLE";
let motis:
  | {
      url: string | undefined;
      token: string | undefined;
      provider: MotisRoutingProvider;
    }
  | undefined;
let hybrid: { identity:string; provider:HybridRoutingProvider } | undefined;
export function routingProvider(fallbackMinutes=80): RoutingProvider {
  if (
    !motisSelected() &&
    process.env.LUMACLEAN_GOOGLE_ROUTING_ENABLED === "true"
  )
    return new GoogleRoutesProvider();
  const url = process.env.LUMACLEAN_ROUTING_URL,
    token = process.env.LUMACLEAN_ROUTING_TOKEN;
  if (!motis || motis.url !== url || motis.token !== token)
    motis = { url, token, provider: new MotisRoutingProvider(url, token) };
  const identity=JSON.stringify([url,token,process.env.BUSMAPS_API_KEY,busMapsAccess(),busMapsMonthlyLimit(),fallbackTravelMinutes(fallbackMinutes)]);
  if(!hybrid||hybrid.identity!==identity)hybrid={identity,provider:new HybridRoutingProvider(motis.provider,new BusMapsTransitProvider(new PrismaBusMapsStore()),fallbackTravelMinutes(fallbackMinutes))};
  return hybrid.provider;
}
