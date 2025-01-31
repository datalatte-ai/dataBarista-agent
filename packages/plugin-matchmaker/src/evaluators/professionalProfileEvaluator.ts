import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, State, elizaLogger, composeContext } from "@elizaos/core";
import { ProfessionalProfile, UserProfileCache } from "../types";
import { extractionTemplate } from "../templates";
import { INITIAL_PROFILE } from '../constants';

export const professionalProfileEvaluator: Evaluator = {
    name: "professionalProfileEvaluator",
    similes: ["EXTRACT_PROFESSIONAL_PROFILE", "GET_NETWORKING_PREFERENCES", "ANALYZE_BACKGROUND"],
    description: "Extracts and maintains professional profile information through stateful conversation processing",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            elizaLogger.info("Validating professionalProfileEvaluator", {
                username,
                messageId: message.id,
                messageContent: message.content.text.substring(0, 100) + "..."
            });
            return true;
        } catch (error) {
            elizaLogger.error("Error in professionalProfileEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            // Get or initialize profile
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);
            const currentProfile = cached?.data || INITIAL_PROFILE;

            // Handle platform account if new user
            if (!cached?.data && message.content.source) {
                const platform = message.content.source.toLowerCase() as "telegram" | "twitter";
                if (Object.keys(runtime.clients).includes(platform)) {
                    currentProfile.platformAccounts.push({ platform, username });
                }
            }

            // Prepare state for extraction
            if (!state) {
                state = await runtime.composeState(message);
            }
            state = await runtime.updateRecentMessageState(state);

            // Extract new information
            const context = composeContext({
                template: extractionTemplate,
                state: {
                    ...state,
                    currentProfile: JSON.stringify(currentProfile, null, 2),
                }
            });

            const result = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!result || Object.keys(result).length === 0) {
                return false;
            }

            // Merge new information with current profile
            const newInfo = result[0];
            const mergedProfile = mergeProfiles(currentProfile, newInfo);

            // Save updated profile
            const cacheData: UserProfileCache = {
                data: mergedProfile,
                extractionState: {
                    currentProfile: mergedProfile,
                    conversationHistory: [...(cached?.extractionState?.conversationHistory || []), message.content.text]
                },
                lastUpdated: Date.now()
            };

            await runtime.cacheManager.set(cacheKey, cacheData);

            elizaLogger.info("Profile updated", {
                username,
                hasNewPersonal: !!newInfo.personal,
                hasNewIntention: !!newInfo.intention,
                finalProfile: JSON.stringify(mergedProfile, null, 2)
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error in professionalProfileEvaluator handler:", error);
            return false;
        }
    },

    examples: []
};

function mergeProfiles(current: ProfessionalProfile, newInfo: any): ProfessionalProfile {
    const merged = { ...current };

    // Merge personal information
    if (newInfo.personal) {
        merged.personal = {
            ...merged.personal,
            ...newInfo.personal,
            // Merge arrays without duplicates
            skills: [...new Set([...(merged.personal.skills || []), ...(newInfo.personal.skills || [])])],
            industries: [...new Set([...(merged.personal.industries || []), ...(newInfo.personal.industries || [])])],
            locations: [...new Set([...(merged.personal.locations || []), ...(newInfo.personal.locations || [])])],
            interests: [...new Set([...(merged.personal.interests || []), ...(newInfo.personal.interests || [])])]
        };
    }

    // Update intention
    if (newInfo.intention) {
        merged.intention = {
            type: newInfo.intention.type || merged.intention.type,
            description: newInfo.intention.description || merged.intention.description,
            preferences: {
                ...merged.intention.preferences,
                ...newInfo.intention.preferences,
                // Merge array fields without duplicates
                requiredSkills: [...new Set([
                    ...(merged.intention.preferences.requiredSkills || []),
                    ...(newInfo.intention.preferences?.requiredSkills || [])
                ])],
                preferredIndustries: [...new Set([
                    ...(merged.intention.preferences.preferredIndustries || []),
                    ...(newInfo.intention.preferences?.preferredIndustries || [])
                ])],
                locationPreferences: [...new Set([
                    ...(merged.intention.preferences.locationPreferences || []),
                    ...(newInfo.intention.preferences?.locationPreferences || [])
                ])]
            }
        };
    }

    return merged;
}