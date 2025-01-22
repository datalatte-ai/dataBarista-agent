import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
import { UserProfile, UserProfileCache } from "../types";
import { REQUIRED_FIELDS } from "../constants";

function formatMissingFields(data: UserProfile): string[] {
    const missing: string[] = [];

    // Check professional context
    REQUIRED_FIELDS.professionalContext.forEach(field => {
        if (typeof field === 'string' && !data.professionalContext?.[field]) {
            missing.push(`professional ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    // Check goals and objectives
    REQUIRED_FIELDS.goalsObjectives.forEach(field => {
        if (typeof field === 'string' && !data.goalsObjectives?.[field]) {
            missing.push(`goals ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    // Check preferences and requirements
    REQUIRED_FIELDS.preferencesRequirements.forEach(field => {
        if (typeof field === 'string' && !data.preferencesRequirements?.[field]) {
            missing.push(`preferences ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        }
    });

    return missing;
}

const userProfileStatusProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);

            elizaLogger.info("UserProfileStatusProvider Check:", {
                username,
                cacheKey,
                hasCache: !!cached,
                completed: cached?.data?.completed,
                data: cached?.data
            });

            // Case 1: No profile
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
            const missingFields = formatMissingFields(data);

            // Case 2: Profile exists but incomplete
            if (missingFields.length > 0) {
                return `
User profile of @${username} is partially filled.

# Instruction for agent:
Please continue engaging in the conversation and naturally ask more to find a few key details: \n\n${missingFields.join("\n")}\n\n`;
            }

            // Case 3: Profile is complete
            return `
Professional Networking Profile for @${username} is complete, please proceed to matchmaking by calling SERENDIPITY action.

Key Profile Information:
- Primary Purpose: ${data.goalsObjectives.primaryPurpose}
- Industry Focus: ${data.preferencesRequirements.industryFocus?.join(", ") || "Not specified"}
- Looking for: ${data.goalsObjectives.relationshipType?.join(", ") || "Not specified"}
- Role: ${data.professionalContext.role}
- Experience: ${data.professionalContext.experienceLevel}
`;
        } catch (error) {
            console.error("Error in userProfileStatusProvider:", error);
            return null;
        }
    }
};

export { userProfileStatusProvider };
