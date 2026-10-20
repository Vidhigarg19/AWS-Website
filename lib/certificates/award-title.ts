export function getAwardTitle(rank: number): string;
export function getAwardTitle(awardTitle: string): string;
export function getAwardTitle(awardTitle: null | undefined): undefined;
export function getAwardTitle(
  awardTitle: string | null | undefined
): string | undefined;
export function getAwardTitle(
  value: number | string | null | undefined
): string | undefined {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError("Rank must be a positive safe integer.");
    }

    if (value === 1) return "1st Position";
    if (value === 2) return "1st Runner Up Position";
    if (value === 3) return "2nd Runner Up Position";

    const lastTwoDigits = value % 100;
    const suffix =
      lastTwoDigits >= 11 && lastTwoDigits <= 13
        ? "th"
        : value % 10 === 1
          ? "st"
          : value % 10 === 2
            ? "nd"
            : value % 10 === 3
              ? "rd"
              : "th";
    return `${value}${suffix} Position`;
  }

  if (typeof value !== "string") return undefined;

  const title = value.trim();
  if (title === "2nd Position") return getAwardTitle(2);
  if (title === "3rd Position") return getAwardTitle(3);
  return title || undefined;
}

export function getCertificateAwardLayout(awardTitle: string): {
  rankText: string;
  contextText: string;
  isRunnerUp: boolean;
} {
  if (
    awardTitle === "1st Runner Up Position" ||
    awardTitle === "2nd Runner Up Position"
  ) {
    return {
      rankText: awardTitle.replace(/ Position$/, ""),
      contextText: "Position in",
      isRunnerUp: true,
    };
  }

  return {
    rankText: awardTitle,
    contextText: "in",
    isRunnerUp: false,
  };
}
