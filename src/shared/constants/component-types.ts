export const COMPONENT_TYPES = [
  'service',
  'database',
  'queue',
  'gateway',
  'cache',
  'storage',
  'external',
  'load_balancer',
  'cdn',
  'other',
] as const

export type ComponentType = (typeof COMPONENT_TYPES)[number]
