export const TEAM_WINGS = [
  {
    key: "technology",
    name: "Technology Wing",
    overview: "Code · Web · AI",
    description:
      "Building the apps, tools and AI features that power our community projects.",
  },
  {
    key: "events-ops",
    name: "Events & Ops Wing",
    overview: "Planning · Logistics · Experience",
    description:
      "Planning and running workshops, hackathons and talks from start to finish.",
  },
  {
    key: "media",
    name: "Media Wing",
    overview: "Film · Photo · Content",
    description:
      "Capturing, editing and publishing the stories behind every build and event.",
  },
  {
    key: "public-relations",
    name: "Public Relations Wing",
    overview: "Outreach · Partnerships · Voice",
    description:
      "Connecting the community with partners, sponsors, colleges and the wider tech scene.",
  },
] as const;

export type TeamWingKey = (typeof TEAM_WINGS)[number]["key"];
export type WingRole = "lead" | "co-lead" | "member";

export interface TeamMemberForGrouping {
  role?: string | null;
  wing?: string | null;
  department?: string | null;
  wing_name?: string | null;
  [field: string]: unknown;
}

interface GroupedTeamMembers<T> {
  core: T[];
  wings: Record<TeamWingKey, { leads: T[]; coLeads: T[]; members: T[] }>;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.-]+/g, " ")
    .replace(/[&/()]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wingFromText(value: string): TeamWingKey | undefined {
  const text = normalize(value);

  if (text.includes("event")) {
    return "events-ops";
  }
  if (text.includes("media") || text.includes("design")) {
    return "media";
  }
  if (text.includes("tech") || text.includes("cloud")) {
    return "technology";
  }
  if (/\bpr\b|\bpublic relations?\b|\boutreach\b/.test(text)) {
    return "public-relations";
  }

  return undefined;
}

export function normalizeTeamBatch(value: string | null | undefined): string {
  const batch = (value ?? "")
    .trim()
    .replace(/^batch\s*/i, "")
    .replace(/\s+/g, "");

  return batch || "2026-27";
}

function getWingRole(roleValue: string | null | undefined): WingRole {
  const role = normalize(roleValue ?? "");
  if (/\bco\b.*\blead\b/.test(role)) return "co-lead";
  if (/\blead\b/.test(role)) {
    return "lead";
  }
  return "member";
}

function isCoreRole(roleValue: string): boolean {
  return /^(leader|group leader|builder group leader|vice leader|vice group leader|secretary|treasurer)$/.test(
    normalize(roleValue)
  );
}

export function groupTeamMembers<T extends TeamMemberForGrouping>(
  input: readonly T[]
): GroupedTeamMembers<T> {
  const grouped: GroupedTeamMembers<T> = {
    core: [],
    wings: {
      technology: { leads: [], coLeads: [], members: [] },
      "events-ops": { leads: [], coLeads: [], members: [] },
      media: { leads: [], coLeads: [], members: [] },
      "public-relations": { leads: [], coLeads: [], members: [] },
    },
  };

  for (const member of input) {
    const role = typeof member.role === "string" ? member.role : "";
    if (isCoreRole(role)) {
      grouped.core.push(member);
      continue;
    }

    const explicitWing = [member.wing, member.wing_name, member.department]
      .filter((value): value is string => typeof value === "string")
      .map(wingFromText)
      .find((wing): wing is TeamWingKey => Boolean(wing));
    const wing = explicitWing ?? wingFromText(role);

    if (!wing) {
      grouped.core.push(member);
      continue;
    }

    const wingRole = getWingRole(role);
    if (wingRole === "co-lead") grouped.wings[wing].coLeads.push(member);
    else if (wingRole === "lead") grouped.wings[wing].leads.push(member);
    else grouped.wings[wing].members.push(member);
  }

  return grouped;
}
