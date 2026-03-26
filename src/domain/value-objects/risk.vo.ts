import { RiskCategory, RiskSeverity } from '@shared/constants/risk-categories'

export class RiskVO {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly severity: RiskSeverity,
    public readonly category: RiskCategory,
    public readonly affectedComponents: string[],
  ) {}

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      severity: this.severity,
      category: this.category,
      affectedComponents: this.affectedComponents,
    }
  }
}
