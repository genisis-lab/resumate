// A curated bank of strong resume action verbs, grouped by theme, plus a small
// heuristic that suggests relevant verbs for a given bullet. Used by the
// writing coach and the \"Action verbs\" palette in the bullet editor.

export const ACTION_VERBS: Record<string, string[]> = {
  Leadership: ["Led", "Directed", "Oversaw", "Spearheaded", "Coordinated", "Orchestrated", "Mentored", "Chaired"],
  Achievement: ["Achieved", "Delivered", "Exceeded", "Improved", "Increased", "Reduced", "Boosted", "Generated"],
  Building: ["Built", "Designed", "Developed", "Engineered", "Architected", "Launched", "Implemented", "Automated"],
  Analysis: ["Analyzed", "Evaluated", "Researched", "Identified", "Diagnosed", "Forecasted", "Modeled"],
  Communication: ["Presented", "Negotiated", "Authored", "Persuaded", "Advised", "Influenced"],
  Improvement: ["Streamlined", "Optimized", "Overhauled", "Standardized", "Modernized", "Consolidated"],
}

// Suggest three strong verbs that fit the topic of a bullet.
export function suggestVerbsFor(text: string): string[] {
  const t = (text || "").toLowerCase()
  if (/\b(team|people|staff|mentor|manage|led|lead|hire|train|direct)\b/.test(t)) return ACTION_VERBS.Leadership.slice(0, 3)
  if (/\b(built|build|develop|code|software|app|feature|design|system|api|platform)\b/.test(t)) return ACTION_VERBS.Building.slice(0, 3)
  if (/\b(data|analy|research|report|metric|kpi|forecast|insight)\b/.test(t)) return ACTION_VERBS.Analysis.slice(0, 3)
  if (/\b(improv|optimi|reduc|faster|efficien|streamlin|cost|save)\b/.test(t)) return ACTION_VERBS.Improvement.slice(0, 3)
  if (/\b(present|client|stakeholder|communicat|wrote|write|document|propos)\b/.test(t)) return ACTION_VERBS.Communication.slice(0, 3)
  return ACTION_VERBS.Achievement.slice(0, 3)
}
