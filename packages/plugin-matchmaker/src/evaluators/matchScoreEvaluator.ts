import { Evaluator, IAgentRuntime, Memory, UUID } from "@elizaos/core";
import { MatchPool, MatchIntention, MatchIntentionCache, MatchPoolCache } from "../types";

interface MatchScore {
    score: number;
    reasons: string[];
}

function calculateMatchScore(user1: MatchIntention, user2: MatchIntention): MatchScore {
    const score: MatchScore = { score: 0, reasons: [] };

    // Check networking goals
    if (user1.networkingGoal === user2.networkingGoal) {
        score.score += 40;
        score.reasons.push("Matching networking goals");
    }

    // Check industry preferences
    const commonIndustries = user1.industryPreference?.filter(
        ind => user2.industryPreference?.includes(ind)
    );
    if (commonIndustries?.length) {
        score.score += 30 * (commonIndustries.length / Math.max(
            user1.industryPreference?.length || 1,
            user2.industryPreference?.length || 1
        ));
        score.reasons.push(`Common industries: ${commonIndustries.join(", ")}`);
    }

    return score;
}

export const matchScoreEvaluator: Evaluator = {
    name: "matchScoreEvaluator",
    similes: ["EVALUATE_MATCH", "CALCULATE_MATCH_SCORE"],
    description: "Evaluates compatibility between users for professional networking",

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const userCacheKey = `${runtime.character.name}/${message.userId}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            return !!userIntentionCache?.data?.completed;
        } catch (error) {
            console.error("Error in matchScoreEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const MATCH_THRESHOLD = 60; // Minimum score for a match

            // Get current user's intention
            const userCacheKey = `${runtime.character.name}/${message.userId}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            if (!userIntentionCache?.data) {
                return false;
            }

            // Get pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
            if (!poolCache?.pools?.length) {
                return false;
            }

            // Calculate scores for all users
            const matches = await Promise.all(poolCache.pools
                .filter(p => p.userId !== message.userId)
                .map(async p => {
                    // We already have the username in the pool data
                    return {
                        user: {
                            ...p,
                            username: p.username // Use the username already stored in the pool
                        },
                        matchScore: calculateMatchScore(userIntentionCache.data, p.matchIntention)
                    };
                }))
                .then(results => results
                    .filter(m => m.matchScore.score >= MATCH_THRESHOLD)
                    .sort((a, b) => b.matchScore.score - a.matchScore.score)
                );

            if (matches.length > 0) {
                // Store matches for serendipity action
                await runtime.cacheManager.set(
                    `${runtime.character.name}/${message.userId}/matches`,
                    {
                        matches,
                        lastUpdated: Date.now()
                    },
                    { expires: Date.now() + (24 * 60 * 60 * 1000) } // 24 hours
                );
                return true;
            }

            return false;
        } catch (error) {
            console.error("Error in matchScoreEvaluator handler:", error);
            return false;
        }
    },

    examples: [
        {
            context: "Evaluating match between two users with similar preferences",
            messages: [
                {
                    user: "User1",
                    content: {
                        text: "I'm looking for mentorship in AI and blockchain"
                    }
                },
                {
                    user: "User2",
                    content: {
                        text: "I want to mentor others in AI technology"
                    }
                }
            ],
            outcome: "Match score: 70% (Matching networking goals: mentorship, Common industries: AI)"
        },
        {
            context: "Evaluating match between users with different goals",
            messages: [
                {
                    user: "User1",
                    content: {
                        text: "Looking for business partnerships in fintech"
                    }
                },
                {
                    user: "User2",
                    content: {
                        text: "Seeking mentorship in AI"
                    }
                }
            ],
            outcome: "Match score: 30% (Different networking goals, No common industries)"
        }
    ]
};