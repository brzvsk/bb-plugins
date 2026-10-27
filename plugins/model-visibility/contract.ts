import { z } from 'zod';

export const menuModelSchema = z.object({
  id: z.string().min(1).max(300),
  displayName: z.string().min(1).max(300),
  routeProviderId: z.string().min(1).max(200).optional(),
});

export const menuProviderSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  brandPrefix: z.string().max(100).optional(),
  models: z.array(menuModelSchema).max(500),
  more: z.array(menuModelSchema).max(500),
  error: z.string().max(500).optional(),
});

export const hiddenMapSchema = z.record(
  z.string().min(1).max(100),
  z.array(z.string().min(1).max(300)).max(500),
);

export const catalogSchema = z.object({
  providers: z.array(menuProviderSchema).max(100),
  hidden: hiddenMapSchema,
});

export type MenuModel = z.infer<typeof menuModelSchema>;
export type MenuProvider = z.infer<typeof menuProviderSchema>;
export type HiddenMap = z.infer<typeof hiddenMapSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
