import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export const bootstrapAdminSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
});

// Explicit policy: percentages stay unset until the owner supplies them.
export const businessSettingsSchema = z.object({
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("ru", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Неизвестный часовой пояс"),
  defaultTravelBufferMinutes: z.number().int().min(0).max(1440),
  defaultCleanerPayoutPercent: z.number().min(0).max(100).nullable(),
});
