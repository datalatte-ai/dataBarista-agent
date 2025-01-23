import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    Content,
    ModelClass,
    generateObjectArray,
    elizaLogger,
    HandlerCallback,
    composeContext
} from "@elizaos/core";
import {
    MatchPool,
    MatchPoolCache,
    UserProfile,
    UserProfileCache,
    MatchHistory,
    MatchRecord
} from "../types";

interface MatchCandidate {
    username: string;
    score: number;
    reasons: string[];
    complementaryFactors: string[];
}

interface MatchEvaluation {
    bestMatch: MatchCandidate | null;
    evaluationSummary: string;
}

// Define the template at module level like userProfileEvaluator
const matchEvaluationTemplate = `
TASK: Evaluate compatibility between two professional profiles.

PROFILE 1:
{{profile1}}

PROFILE 2:
{{profile2}}

Format the response as an array with a single object:
[{
    "isMatch": boolean,        // true if profiles are compatible
    "matchScore": number,      // 0.0-1.0 indicating match quality
    "reasons": string[]       // List of specific reasons for the match
}]

Return an empty array if evaluation cannot be made.`;

export const serendipityAction: Action = {
    name: "SERENDIPITY",
    description: "Call this action when user has completed their profile and is searching for a match.",
    similes: [
        "NOTIFY_MATCH",
        "INTRODUCE_MATCH",
        "CONNECT_USERS",
        "SUGGEST_CONNECTION",
        "PROPOSE_MATCH",
        "NETWORK_MATCH",
        "FIND_MATCH",
        "MATCH_FOUND"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const userProfileCache = await getUserProfile(runtime, username);

            if (!userProfileCache?.data) {
                elizaLogger.warn(`No profile found for user ${username}`);
                return false;
            }

            const data = userProfileCache.data;
            const hasMinimumFields =
                data.goalsObjectives?.primaryPurpose &&
                data.goalsObjectives?.relationshipType?.length > 0 &&
                data.preferencesRequirements?.industryFocus?.length > 0;

            elizaLogger.info("Profile validation result:", {
                username,
                hasMinimumFields,
                goals: {
                    hasPurpose: !!data.goalsObjectives?.primaryPurpose,
                    hasRelationType: (data.goalsObjectives?.relationshipType?.length || 0) > 0
                },
                preferences: {
                    hasIndustryFocus: (data.preferencesRequirements?.industryFocus?.length || 0) > 0
                }
            });

            return hasMinimumFields;
        } catch (error) {
            elizaLogger.error("Error in serendipity validate:", error);
            return false;
        }
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ): Promise<Content | void> => {
        try {
            elizaLogger.info("=== Starting Serendipity Matchmaking ===");

            // 1. Get user profile and validate
            const username = state?.senderName || message.userId;
            elizaLogger.info("Getting user profile for:", { username });

            const userProfileCache = await getUserProfile(runtime, username);
            if (!userProfileCache?.data) {
                elizaLogger.warn("No profile found for user", { username });
                return {
                    text: "I need more information about your professional background before I can find matches.",
                    action: "CONTINUE"
                };
            }

            elizaLogger.info("User profile retrieved:", {
                role: userProfileCache.data.professionalContext.role,
                industry: userProfileCache.data.professionalContext.industry,
                goals: userProfileCache.data.goalsObjectives.targetOutcomes
            });

            // 2. Get match pool
            const matchPool = await getMatchPool(runtime, message.userId);
            elizaLogger.info("Match pool retrieved:", {
                poolSize: matchPool.length,
                candidates: matchPool.map(m => ({
                    username: m.username,
                    role: m.matchIntention.professionalContext.role,
                    industry: m.matchIntention.professionalContext.industry
                }))
            });

            if (!matchPool.length) {
                elizaLogger.info("No potential matches in pool");
                return {
                    text: "I haven't found any potential matches yet. I'll keep looking!",
                    action: "SERENDIPITY"
                };
            }

            // 3. Evaluate matches one at a time
            for (const potentialMatch of matchPool) {
                elizaLogger.info("Evaluating potential match:", {
                    username: potentialMatch.username,
                    role: potentialMatch.matchIntention.professionalContext.role,
                    industry: potentialMatch.matchIntention.professionalContext.industry
                });

                const matchResult = await evaluateMatch(runtime, userProfileCache.data, potentialMatch, message.userId);

                if (matchResult) {
                    elizaLogger.info("Match found and notification prepared:", {
                        matchedUsername: potentialMatch.username,
                        notification: matchResult
                    });

                    // Create response with CONTINUE action
                    const response: Content = {
                        text: matchResult.text,
                        action: "CONTINUE"  // Changed from SERENDIPITY to CONTINUE
                    };

                    // Use callback if available
                    if (callback) {
                        elizaLogger.info("Sending response via callback");
                        await callback(response);
                    }

                    elizaLogger.info("Returning match notification:", { response });
                    return response;
                }
            }

            // 4. No matches found
            const noMatchResponse: Content = {
                text: "Still looking for the perfect match! I'll keep searching for someone who aligns with your goals.",
                action: "CONTINUE"  // Changed from SERENDIPITY to CONTINUE
            };

            if (callback) {
                await callback(noMatchResponse);
            }

            return noMatchResponse;

        } catch (error) {
            elizaLogger.error("Error in serendipity handler:", error);
            const errorResponse: Content = {
                text: "I encountered an issue while searching for matches. I'll try again shortly.",
                action: "CONTINUE"
            };

            if (callback) {
                await callback(errorResponse);
            }

            return errorResponse;
        }
    },

    examples: [] as ActionExample[][],
};

// Helper Functions

async function getUserProfile(runtime: IAgentRuntime, username: string): Promise<UserProfileCache | null> {
    const userCacheKey = `${runtime.character.name}/${username}/data`;
    return await runtime.cacheManager.get<UserProfileCache>(userCacheKey);
}

async function getMatchPool(runtime: IAgentRuntime, currentUserId: string): Promise<MatchPool[]> {
    const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
    const matchPool = poolCache?.pools || [];
    return matchPool.filter(p => p.userId !== currentUserId);
}

function createMatchmakingTemplate(currentUser: UserProfile, potentialMatch: MatchPool): string {
    const profile1 = `Role: ${currentUser.professionalContext.role}
Industry: ${currentUser.professionalContext.industry}
Experience: ${currentUser.professionalContext.experienceLevel}
Goals: ${currentUser.goalsObjectives.targetOutcomes?.join(', ')}
Looking for: ${currentUser.goalsObjectives.relationshipType?.join(', ')}`;

    const profile2 = `Role: ${potentialMatch.matchIntention.professionalContext.role}
Industry: ${potentialMatch.matchIntention.professionalContext.industry}
Experience: ${potentialMatch.matchIntention.professionalContext.experienceLevel}
Goals: ${potentialMatch.matchIntention.goalsObjectives.targetOutcomes?.join(', ')}
Looking for: ${potentialMatch.matchIntention.goalsObjectives.relationshipType?.join(', ')}`;

    return composeContext({
        template: matchEvaluationTemplate,
        state: {
            bio: "",
            lore: "",
            messageDirections: "",
            postDirections: "",
            recentMessages: "",
            currentInfo: "",
            senderName: "",
            agentName: "",
            actorsData: [],
            recentMessagesData: [],
            roomId: "",
            actors: "",
            profile1,
            profile2
        }
    });
}

async function evaluateMatch(
    runtime: IAgentRuntime,
    currentUser: UserProfile,
    potentialMatch: MatchPool,
    userId: string
): Promise<Content | null> {
    elizaLogger.info("Starting match evaluation", {
        currentUser: {
            role: currentUser.professionalContext.role,
            industry: currentUser.professionalContext.industry,
            goals: currentUser.goalsObjectives.targetOutcomes
        },
        potentialMatch: {
            username: potentialMatch.username,
            role: potentialMatch.matchIntention.professionalContext.role,
            industry: potentialMatch.matchIntention.professionalContext.industry
        }
    });

    const context = createMatchmakingTemplate(currentUser, potentialMatch);
    elizaLogger.info("Generated match evaluation template:", { context });

    try {
        const results = await generateObjectArray({
            runtime,
            context,
            modelClass: ModelClass.LARGE // Using LARGE like userProfileEvaluator
        });

        if (!results?.length) {
            elizaLogger.warn("No evaluation results returned");
            return null;
        }

        const result = results[0];
        elizaLogger.info("Processing evaluation result:", {
            isMatch: result.isMatch,
            matchScore: result.matchScore,
            reasons: result.reasons,
            confidence: result.confidence
        });

        if (result.isMatch && result.matchScore >= 0.1) {
            elizaLogger.info("Match criteria met", {
                username: potentialMatch.username,
                score: result.matchScore
            });

            // Store the match data
            const matchCacheKey = `matchmaker/matches/${userId}`;
            const existingMatches = await runtime.cacheManager.get<MatchHistory>(matchCacheKey) || { matches: [] };

            elizaLogger.info("Existing matches found:", {
                count: existingMatches.matches.length,
                matchCacheKey
            });

            const newMatch: MatchRecord = {
                userId: potentialMatch.userId,
                username: potentialMatch.username,
                matchedAt: Date.now(),
                matchScore: result.matchScore,
                reasons: result.reasons,
                complementaryFactors: ["Technical expertise complement", "Industry alignment"],
                potentialSynergies: [],
                status: 'pending'
            };

            elizaLogger.info("Storing new match:", { newMatch });

            await runtime.cacheManager.set(matchCacheKey, {
                matches: [...existingMatches.matches, newMatch],
                lastUpdated: Date.now()
            });

            elizaLogger.info("Match successfully stored");

            // Return detailed match notification
            return {
                text: `Great news! I found a match for you! @${potentialMatch.username} (${potentialMatch.matchIntention.professionalContext.role}) is interested in ${potentialMatch.matchIntention.preferencesRequirements.industryFocus?.join(", ")}.

Their goals: ${potentialMatch.matchIntention.goalsObjectives.targetOutcomes?.join(", ")}

Why this is a great match:
${result.reasons.map(r => `• ${r}`).join('\n')}

Would you like me to make an introduction?`,
                action: "SERENDIPITY"
            };
        }

        elizaLogger.info("Match criteria not met", {
            username: potentialMatch.username,
            score: result.matchScore
        });
        return null;
    } catch (error) {
        elizaLogger.error("Error in match evaluation:", error);
        return null;
    }
}

function formatProfileSummary(profile: UserProfile): string {
    const { professionalContext, goalsObjectives, preferencesRequirements } = profile;
    return `Role: ${professionalContext.role || 'Not specified'}
Industry: ${professionalContext.industry || 'Not specified'}
Experience: ${professionalContext.experienceLevel || 'Not specified'}
Expertise: ${professionalContext.expertise?.join(', ') || 'Not specified'}
Goals: ${goalsObjectives.targetOutcomes?.join(', ') || 'Not specified'}
Looking for: ${goalsObjectives.relationshipType?.join(', ') || 'Not specified'}
Industry focus: ${preferencesRequirements.industryFocus?.join(', ') || 'Not specified'}`;
}