export interface MatchPool {
    userId: string; // UUID
    username: string; // For introductions (telegram, discord, etc.)
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

export interface MatchRecord {
    userId: string;
    username: string;
    matchedAt: number;
    reasons: string[];
    status: 'pending' | 'accepted' | 'rejected';
}

export interface MatchHistory {
    matches: MatchRecord[];
    lastUpdated: number;
}