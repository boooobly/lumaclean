import { buildAgentTemporalContext, serviceDatePolicy } from '@/lib/agent/temporal';

type Settings = Parameters<typeof serviceDatePolicy>[1];
// The date is a preference, not an available slot or a scheduledStart.
export function websiteDatePolicy(input: {preferredDate?: string; urgent: boolean}, settings: Settings, now = new Date()) {
  const date = input.preferredDate ?? (input.urgent ? buildAgentTemporalContext(now, settings, now).nowLocalDate : undefined);
  if (!date) return {urgent: false} as const;
  return serviceDatePolicy(date, settings, now);
}

export const preferredTimeLabels = {MORNING: 'Утро', AFTERNOON: 'День', EVENING: 'Вечер'} as const;
