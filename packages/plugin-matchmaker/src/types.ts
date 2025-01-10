export interface MatchIntention {
    networkingGoal?: string; // e.g., "mentorship", "collaboration", "business partnership"
    industryPreference?: string[]; // e.g., ["AI", "Blockchain"]
    completed: boolean;
}

export interface MatchIntentionCache {
    data: MatchIntention;
    lastUpdated: number;
}

export interface MatchPool {
    userId: string; // UUID
    username: string; // For introductions (telegram, discord, etc.)
    matchIntention: MatchIntention;
    lastActive: number;
    contactInfo?: {
        email?: string;
        preferredContact?: string;
    };
}

export interface MatchPoolCache {
    pools: MatchPool[];
    lastUpdated: number;
}