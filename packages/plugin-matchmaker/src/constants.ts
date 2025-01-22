export const REQUIRED_FIELDS = {
    professionalContext: [] as string[],
    goalsObjectives: [
        "primaryPurpose",
        "relationshipType"
    ] as string[],
    preferencesRequirements: [
        "industryFocus"
    ] as string[]
} as const;

export const NETWORKING_PURPOSES = [
    "investing",
    "seeking_investment",
    "mentorship",
    "collaboration",
    "business_partnership",
    "hiring",
    "job_seeking",
    "market_expansion",
    "knowledge_sharing",
    "media_coverage"
] as const;

export const RELATIONSHIP_TYPES = [
    "investor",
    "mentor",
    "collaborator",
    "business_partner",
    "employee",
    "employer",
    "advisor",
    "media_contact",
    "co_investor"
] as const;

export const EXPERIENCE_LEVELS = [
    "entry",
    "intermediate",
    "senior",
    "executive",
    "expert"
] as const;

export const COMPANY_STAGES = [
    "idea",
    "pre_seed",
    "seed",
    "series_a",
    "series_b",
    "series_c_plus",
    "public",
    "established"
] as const;