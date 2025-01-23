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
    HandlerCallback
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
    return `Evaluate match compatibility between two profiles:

PROFILE 1:
Role: ${currentUser.professionalContext.role}
Industry: ${currentUser.professionalContext.industry}
Goals: ${currentUser.goalsObjectives.targetOutcomes?.join(', ')}

PROFILE 2:
Role: ${potentialMatch.matchIntention.professionalContext.role}
Industry: ${potentialMatch.matchIntention.professionalContext.industry}
Goals: ${potentialMatch.matchIntention.goalsObjectives.targetOutcomes?.join(', ')}

Return a JSON array with one object: [{
    "isMatch": true/false,
    "matchScore": 0.0-1.0,
    "reasons": ["reason1", "reason2", ...]
}]`;
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

    const template = createMatchmakingTemplate(currentUser, potentialMatch);
    elizaLogger.info("Generated match evaluation template:", { template });

    const MAX_RETRIES = 3;
    let retryCount = 0;
    let results = null;

    while (retryCount < MAX_RETRIES) {
        try {
            results = await Promise.race([
                generateObjectArray({
                    runtime,
                    context: template,
                    modelClass: ModelClass.SMALL
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Model timeout')), 30000)
                )
            ]);

            if (results?.[0]) {
                break; // Successfully got results
            }

            retryCount++;
            elizaLogger.warn(`Attempt ${retryCount} failed to get valid results`);

            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
            }
        } catch (error) {
            retryCount++;
            elizaLogger.error(`Attempt ${retryCount} failed with error:`, error);

            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
        }
    }

    if (!results?.[0]) {
        elizaLogger.warn("Failed to get evaluation results after all retries");
        return null;
    }

    const result = results[0];
    elizaLogger.info("Processing evaluation result:", {
        isMatch: result.isMatch,
        matchScore: result.matchScore,
        reasons: result.reasons
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