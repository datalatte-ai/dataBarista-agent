import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    Content,
} from "@elizaos/core";
import { MatchPool, MatchPoolCache, MatchIntention, MatchIntentionCache } from "../types";

interface MatchScore {
    score: number;
    reasons: string[];
}

interface MatchResult {
    user: MatchPool;
    matchScore: MatchScore;
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

export const serendipityAction: Action = {
    name: "SERENDIPITY",
    description: "Evaluates potential matches and notifies users when a compatible networking match is found",
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
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            // Only proceed if user has completed their profile
            if (!userIntentionCache?.data?.completed) {
                return false;
            }

            // Check if there are potential matches in the pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
            return !!poolCache?.pools?.some(p => p.userId !== message.userId);
        } catch (error) {
            console.error("Error in serendipity validate:", error);
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
            const MATCH_THRESHOLD = 60; // Minimum score for a match
            const username = state?.senderName || message.userId;

            // Get current user's intention
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            if (!userIntentionCache?.data?.completed) {
                return;
            }

            // Get pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
            if (!poolCache?.pools?.length) {
                return;
            }

            // Calculate scores for all users
            const matches = await Promise.all(poolCache.pools
                .filter(p => p.userId !== message.userId) // Filter out self
                .map(async p => {
                    return {
                        user: p,
                        matchScore: calculateMatchScore(userIntentionCache.data, p.matchIntention)
                    };
                }))
                .then(results => results
                    .filter(m => m.matchScore.score >= MATCH_THRESHOLD)
                    .sort((a, b) => b.matchScore.score - a.matchScore.score)
                );

            if (!matches.length) {
                return;
            }

            // Get the best match
            const bestMatch = matches[0];

            // Update the matched user's last active time
            if (poolCache?.pools) {
                const now = Date.now();
                const updatedPools = poolCache.pools.map(p =>
                    p.userId === bestMatch.user.userId
                        ? { ...p, lastActive: now }
                        : p
                );

                await runtime.cacheManager.set("matchmaker/pool", {
                    pools: updatedPools,
                    lastUpdated: now
                }, {
                    expires: now + (30 * 24 * 60 * 60 * 1000) // 30 days
                });
            }

            // Get username from state or database
            let displayUsername = username;
            if (!state?.senderName) {
                const userData = await runtime.databaseAdapter.getAccountById(message.userId);
                displayUsername = userData?.username || username;
            }

            // Update current user in pool
            const currentUser: MatchPool = {
                userId: message.userId,
                username: displayUsername,
                matchIntention: userIntentionCache.data,
                lastActive: Date.now()
            };

            const updatedPools = poolCache.pools
                .filter(p => p.userId !== message.userId)
                .concat(currentUser);

            await runtime.cacheManager.set("matchmaker/pool", {
                pools: updatedPools,
                lastUpdated: Date.now()
            }, {
                expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
            });

            const response: Content = {
                text: `I found a great networking match for you! @${bestMatch.user.username} is also interested in ${bestMatch.user.matchIntention.industryPreference?.join(", ")}. Their networking goal is: ${bestMatch.user.matchIntention.networkingGoal}. Match score: ${bestMatch.matchScore.score}% (${bestMatch.matchScore.reasons.join(", ")}). Would you like me to make an introduction?`,
                action: "SERENDIPITY"
            };

            if (callback) {
                await callback(response);
            }

            return response;
        } catch (error) {
            console.error("Error in serendipity handler:", error);
            return;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I'm looking to connect with other tech professionals",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I found a great networking match for you! @techpro is also interested in Software Development, AI. Their networking goal is: Looking for mentorship opportunities in tech startups. Match score: 85% (Matching networking goals, Common industries: Software Development, AI). Would you like me to make an introduction?",
                    action: "SERENDIPITY"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Looking for fintech connections",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I found a great networking match for you! @fintech_expert is also interested in Financial Technology, Blockchain. Their networking goal is: Seeking collaboration on innovative fintech projects. Match score: 90% (Matching networking goals, Common industries: Financial Technology, Blockchain). Would you like me to make an introduction?",
                    action: "SERENDIPITY"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Need to expand my startup network",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I found a great networking match for you! @startup_founder is also interested in Entrepreneurship, Technology. Their networking goal is: Looking to connect with other founders for potential partnerships. Match score: 75% (Matching networking goals, Common industries: Technology). Would you like me to make an introduction?",
                    action: "SERENDIPITY"
                },
            },
        ]
    ] as ActionExample[][],
};