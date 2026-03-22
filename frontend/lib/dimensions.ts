/** Shared dimension label mapping: English key → Chinese display */
export const DIMENSION_LABELS: Record<string, string> = {
  market_demand: "市场需求",
  business_model: "商业模式",
  tech_feasibility: "技术可行性",
  competitive_advantage: "竞争优势",
  user_experience: "用户体验",
  team_fit: "团队匹配",
};

/** Get Chinese label for a dimension key, fallback to key itself */
export function getDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
}
