import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import { UserProfile, UserProfileCache } from "../types";
import { REQUIRED_FIELDS, NETWORKING_PURPOSES, RELATIONSHIP_TYPES, EXPERIENCE_LEVELS, COMPANY_STAGES } from "../constants";

function formatMissingFields(data: UserProfile): string[] {
    const missing: string[] = [];

    // Check professional context
    REQUIRED_FIELDS.professionalContext.forEach(field => {
        if (!data.professionalContext?.[field]) {
            missing.push(`professional ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    // Check goals and objectives
    REQUIRED_FIELDS.goalsObjectives.forEach(field => {
        if (!data.goalsObjectives?.[field]) {
            missing.push(`goals ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    // Check preferences and requirements
    REQUIRED_FIELDS.preferencesRequirements.forEach(field => {
        if (!data.preferencesRequirements?.[field]) {
            missing.push(`preferences ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    return missing;
}

function formatProfileData(data: UserProfile): string {
    const sections: string[] = [];

    // Professional Context
    const context = data.professionalContext;
    if (context) {
        sections.push("Professional Context:");
        if (context.role) sections.push(`- Role: ${context.role}`);
        if (context.industry) sections.push(`- Industry: ${context.industry}`);
        if (context.experienceLevel) sections.push(`- Experience Level: ${context.experienceLevel}`);
        if (context.companyStage) sections.push(`- Company Stage: ${context.companyStage}`);
        if (context.location) sections.push(`- Location: ${context.location}`);
        if (context.expertise?.length) sections.push(`- Expertise: ${context.expertise.join(", ")}`);
    }

    // Goals & Objectives
    const goals = data.goalsObjectives;
    if (goals) {
        sections.push("\nGoals & Objectives:");
        if (goals.primaryPurpose) sections.push(`- Primary Purpose: ${goals.primaryPurpose}`);
        if (goals.targetOutcomes?.length) sections.push(`- Target Outcomes: ${goals.targetOutcomes.join(", ")}`);
        if (goals.timeline) sections.push(`- Timeline: ${goals.timeline}`);
        if (goals.scale) {
            const scaleDetails = [];
            if (goals.scale.fundingAmount) scaleDetails.push(`Funding: ${goals.scale.fundingAmount}`);
            if (goals.scale.marketReach) scaleDetails.push(`Market Reach: ${goals.scale.marketReach}`);
            if (goals.scale.other) scaleDetails.push(goals.scale.other);
            if (scaleDetails.length) sections.push(`- Scale: ${scaleDetails.join(" | ")}`);
        }
        if (goals.relationshipType?.length) sections.push(`- Seeking: ${goals.relationshipType.join(", ")}`);
    }

    // Preferences & Requirements
    const prefs = data.preferencesRequirements;
    if (prefs) {
        sections.push("\nPreferences & Requirements:");
        if (prefs.counterpartProfiles) {
            const profiles = [];
            if (prefs.counterpartProfiles.experienceLevel?.length) {
                profiles.push(`Experience: ${prefs.counterpartProfiles.experienceLevel.join(", ")}`);
            }
            if (prefs.counterpartProfiles.background?.length) {
                profiles.push(`Background: ${prefs.counterpartProfiles.background.join(", ")}`);
            }
            if (profiles.length) sections.push(`- Ideal Profiles: ${profiles.join(" | ")}`);
        }
        if (prefs.geographicPreferences?.length) sections.push(`- Geographic Focus: ${prefs.geographicPreferences.join(", ")}`);
        if (prefs.industryFocus?.length) sections.push(`- Industry Focus: ${prefs.industryFocus.join(", ")}`);
        if (prefs.stagePreferences?.length) sections.push(`- Preferred Stages: ${prefs.stagePreferences.join(", ")}`);
        if (prefs.requiredExpertise?.length) sections.push(`- Required Expertise: ${prefs.requiredExpertise.join(", ")}`);
        if (prefs.dealParameters) {
            const dealDetails = [];
            if (prefs.dealParameters.investmentSize) dealDetails.push(`Investment Size: ${prefs.dealParameters.investmentSize}`);
            if (prefs.dealParameters.metrics?.length) dealDetails.push(`Metrics: ${prefs.dealParameters.metrics.join(", ")}`);
            if (prefs.dealParameters.other) dealDetails.push(prefs.dealParameters.other);
            if (dealDetails.length) sections.push(`- Deal Parameters: ${dealDetails.join(" | ")}`);
        }
    }

    return sections.join("\n");
}

const userProfileStatusProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);

            if (!cached?.data) {
                return `
No professional profile found for @${username}.

# Instructions for agent:
Gather relevant info naturally in conversation without overwelming the user (max 1 question in each reply):
- Professional Context (role, industry, experience level, company stage, location, expertise)
- Goals & Objectives (networking purpose, target outcomes, timeline, scale, relationship type)
- Preferences & Requirements (geographic preferences, industry focus, stage preferences, required expertise)`;
            }

            const data = cached.data;
            if (data.completed) {
                return `
Professional Networking Profile for @${username} is complete, please proceed to matchmaking by calling SERENDIPITY action.

Key Profile Information:
- Primary Purpose: ${data.goalsObjectives.primaryPurpose}
- Industry Focus: ${data.preferencesRequirements.industryFocus?.join(", ") || "Not specified"}
- Looking for: ${data.goalsObjectives.relationshipType?.join(", ") || "Not specified"}
- Role: ${data.professionalContext.role}
- Experience: ${data.professionalContext.experienceLevel}
`;
            }

            const missingFields = formatMissingFields(cached.data);
            if (missingFields.length > 0) {
                return `
User profile of @${username} is partially filled.

# Instruction for agent:
Please continue engaging in the conversation and naturally ask more to find a few key details: \n\n${missingFields.join("\n")}\n\n
`;
            }

            return formatProfileData(cached.data);
        } catch (error) {
            console.error("Error in userProfileStatusProvider:", error);
            return null;
        }
    }
};

export { userProfileStatusProvider };
