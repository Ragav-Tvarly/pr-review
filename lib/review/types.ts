export const RISKS = ["critical", "high", "important", "normal", "low", "safe"] as const;
export type Risk = (typeof RISKS)[number];

export const RISK_LABEL_PREFIX = "risk: ";

export function riskFromLabels(labels: string[]): Risk | null {
  for (const label of labels) {
    if (!label.startsWith(RISK_LABEL_PREFIX)) continue;
    const value = label.slice(RISK_LABEL_PREFIX.length) as Risk;
    if (RISKS.includes(value)) return value;
  }
  return null;
}
