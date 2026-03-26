export type RecommendationPriority = 'high' | 'medium' | 'low'
export type RecommendationEffort = 'low' | 'medium' | 'high'

export class RecommendationVO {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly priority: RecommendationPriority,
    public readonly effort: RecommendationEffort,
    public readonly relatedRisks: string[],
  ) {}

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      priority: this.priority,
      effort: this.effort,
      relatedRisks: this.relatedRisks,
    }
  }
}
