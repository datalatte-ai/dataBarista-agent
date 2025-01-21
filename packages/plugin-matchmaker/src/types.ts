export interface ProfessionalContext {
    role: string | null;
    industry: string | null;
    experienceLevel: string | null;
    companyStage: string | null;
    location: string | null;
    expertise: string[] | null;
    confidence: {
        [key: string]: number;
    };
}

export interface GoalsObjectives {
    primaryPurpose: string | null;
    targetOutcomes: string[] | null;
    timeline: string | null;
    scale: {
        fundingAmount?: string;
        marketReach?: string;
        other?: string;
    } | null;
    relationshipType: string[] | null;
    confidence: {
        [key: string]: number;
    };
}

export interface PreferencesRequirements {
    counterpartProfiles: {
        experienceLevel?: string[];
        background?: string[];
    } | null;
    geographicPreferences: string[] | null;
    industryFocus: string[] | null;
    stagePreferences: string[] | null;
    requiredExpertise: string[] | null;
    dealParameters: {
        investmentSize?: string;
        metrics?: string[];
        other?: string;
    } | null;
    confidence: {
        [key: string]: number;
    };
}

export interface UserProfile {
    professionalContext: {
        role: string | null;
        industry: string | null;
        experienceLevel: string | null;
        companyStage: string | null;
        location: string | null;
        expertise: string[] | null;
        confidence: Record<string, number>;
    };
    goalsObjectives: {
        primaryPurpose: string | null;
        targetOutcomes: string[] | null;
        timeline: string | null;
        scale: {
            fundingAmount: string | null;
            marketReach: string | null;
            other: string | null;
        } | null;
        relationshipType: string[] | null;
        confidence: Record<string, number>;
    };
    preferencesRequirements: {
        counterpartProfiles: {
            experienceLevel: string[] | null;
            background: string[] | null;
        } | null;
        geographicPreferences: string[] | null;
        industryFocus: string[] | null;
        stagePreferences: string[] | null;
        requiredExpertise: string[] | null;
        dealParameters: {
            investmentSize: string | null;
            metrics: string[] | null;
            other: string | null;
        } | null;
        confidence: Record<string, number>;
    };
    completed: boolean;
    lastUpdated: string;
}

export interface UserProfileCache {
    data: UserProfile;
    lastUpdated: number;
}

export interface MatchPool {
    userId: string;
    username: string;
    lastActive: number;
    contactInfo?: string;
    matchIntention: UserProfile;
}

export interface MatchPoolCache {
    pools: MatchPool[];
    lastUpdated: number;
}

export interface MatchRecord {
    userId: string;
    username: string;
    matchedAt: number;
    matchScore: number;
    reasons: string[];
    complementaryFactors: string[];
    potentialSynergies: string[];
    status: 'pending' | 'accepted' | 'rejected';
}

export interface MatchHistory {
    matches: MatchRecord[];
    lastUpdated: number;
}