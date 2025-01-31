export interface ProfessionalProfile {
    // Core Identity
    platformAccounts: Array<{
        platform: "telegram" | "twitter" | "facebook" | "linkedin" | "irl";
        username: string;
    }>;

    // Personal Information
    personal: {
        role?: string;
        skills?: string[];
        industries?: string[];
        experienceLevel?: "entry" | "mid" | "senior" | "executive";
        locations?: string[];
        interests?: string[];
        education?: string[];
        eventsAttended?: Array<{
            name: string;
            date?: string;
            location?: string;
        }>;
    };

    // Intentions & Preferences
    intention: {
        type: string;
        description: string;
        preferences: {
            requiredSkills?: string[];
            preferredIndustries?: string[];
            experienceLevel?: "entry" | "mid" | "senior" | "executive";
            locationPreferences?: string[];
            companySize?: "startup" | "SME" | "enterprise";
            remotePreference?: "onsite" | "remote" | "hybrid";
            contractType?: "full-time" | "part-time" | "freelance" | "internship";
        };
        budget?: string;
        timeline?: string;
        urgency?: "low" | "medium" | "high";
    };
}

export interface UserProfileCache {
    data: ProfessionalProfile;
    lastUpdated: number;
    extractionState?: {
        currentProfile: ProfessionalProfile;
        conversationHistory: string[];
    };
}

// DKG Types
export type UUID = string;
