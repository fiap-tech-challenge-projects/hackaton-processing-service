export const RISK_CATEGORIES = [
  'security',
  'scalability',
  'reliability',
  'performance',
  'maintainability',
  'cost',
] as const

export type RiskCategory = (typeof RISK_CATEGORIES)[number]

export const RISK_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const

export type RiskSeverity = (typeof RISK_SEVERITIES)[number]
