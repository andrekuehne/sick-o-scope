import { z } from "zod";

/**
 * Answer of `GET /api/status`: the Worker runs and can reach its database.
 * (Deliberately not called "health": Healthy is a Check-in status, see GLOSSARY.md.)
 */
export const ServiceStatus = z.object({
  status: z.literal("ok"),
  database: z.literal("ok"),
});
export type ServiceStatus = z.infer<typeof ServiceStatus>;
