import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    Content,
    ModelClass,
    generateObjectArray,
    composeContext,
} from "@elizaos/core";
import {
    MatchPool,
    MatchPoolCache,
    MatchIntention,
    MatchIntentionCache,
    MatchHistory,
    MatchRecord
} from "../types";

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

            // Get user's profile
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
            const username = state?.senderName || message.userId;

            // Get user's profile
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            if (!userIntentionCache?.data?.completed) {
                return;
            }

            // Get username from state or database
            let displayUsername = username;
            if (!state?.senderName) {
                const userData = await runtime.databaseAdapter.getAccountById(message.userId);
                displayUsername = userData?.username || username;
            }

            // Create current user object
            const currentUser: MatchPool = {
                userId: message.userId,
                username: displayUsername,
                matchIntention: userIntentionCache.data,
                lastActive: Date.now()
            };

            // Get pool and update with current user
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
            if (!poolCache?.pools?.length) {
                // If pool is empty, just add current user
                await runtime.cacheManager.set("matchmaker/pool", {
                    pools: [currentUser],
                    lastUpdated: Date.now()
                }, {
                    expires: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                });
                return;
            }

            // Find potential matches
            for (const potentialMatch of poolCache.pools) {
                if (potentialMatch.userId === message.userId) continue;

                // Debug logs to verify data
                console.log("Current User Data:", {
                    displayUsername,
                    userIntentionCache: userIntentionCache.data
                });
                console.log("Potential Match Data:", potentialMatch);

                const evaluationState = {
                    currentProfile: {
                        username: displayUsername,
                        matchIntention: {
                            networkingGoal: userIntentionCache.data.networkingGoal,
                            industryPreference: userIntentionCache.data.industryPreference
                        }
                    },
                    potentialMatch: {
                        username: potentialMatch.username,
                        matchIntention: {
                            networkingGoal: potentialMatch.matchIntention.networkingGoal,
                            industryPreference: potentialMatch.matchIntention.industryPreference
                        }
                    },
                    // Required state fields
                    bio: "",
                    lore: "",
                    messageDirections: "",
                    postDirections: "",
                    recentMessages: "",
                    senderName: username,
                    agentName: runtime.character.name,
                    actorsData: [],
                    recentMessagesData: [],
                    roomId: message.roomId,
                    actors: ""
                };

                console.log("Evaluation State:", evaluationState);

                const matchEvaluationTemplate = `
TASK: Evaluate if these users would be a good professional networking match.

Current User:
Username: ${evaluationState.currentProfile.username}
Networking Goal: ${evaluationState.currentProfile.matchIntention.networkingGoal}
Industry Interests: ${evaluationState.currentProfile.matchIntention.industryPreference}

Potential Match:
Username: ${evaluationState.potentialMatch.username}
Networking Goal: ${evaluationState.potentialMatch.matchIntention.networkingGoal}
Industry Interests: ${evaluationState.potentialMatch.matchIntention.industryPreference}

Format the response as an array of objects with the following structure:
[{
    "isMatch": boolean,
    "reasons": string[]
}]

Consider:
1. Alignment of networking goals
2. Overlap in industry interests
3. Potential for meaningful professional connection

Return an empty array if you cannot make a determination.
`;

                const context = composeContext({
                    template: matchEvaluationTemplate,
                    state: evaluationState
                });

                console.log("Composed Context:", context);

                const results = await generateObjectArray({
                    runtime,
                    context,
                    modelClass: ModelClass.SMALL
                });

                console.log("Match Results:", results);

                if (results?.[0]?.isMatch) {
                    // Store the match data
                    const matchCacheKey = `matchmaker/matches/${message.userId}`;
                    const existingMatches = await runtime.cacheManager.get<MatchHistory>(matchCacheKey) || { matches: [] };

                    const newMatch = {
                        userId: potentialMatch.userId,
                        username: potentialMatch.username,
                        matchedAt: Date.now(),
                        reasons: results[0].reasons,
                        status: 'pending'
                    };

                    await runtime.cacheManager.set(matchCacheKey, {
                        matches: [...existingMatches.matches, newMatch],
                        lastUpdated: Date.now()
                    });

                    // Return match notification with specific user
                    const response: Content = {
                        text: `Great news! I found a match for you! @${potentialMatch.username} is also interested in ${potentialMatch.matchIntention.industryPreference.join(", ")}. Their networking goal is: ${potentialMatch.matchIntention.networkingGoal}. Would you like me to make an introduction?`,
                        action: "SERENDIPITY"
                    };

                    if (callback) {
                        await callback(response);
                    }

                    return response;
                }
            }

            return;
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
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found a great networking match for you! @username is also interested in Software Development, AI. Their networking goal is: Looking for mentorship opportunities in tech startups. Reasons for match: Aligned industry interests in AI, Shared goal of professional collaboration. Would you like me to make an introduction?"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Looking for fintech connections",
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found a great networking match for you! @username is also interested in Financial Technology, Blockchain. Their networking goal is: Seeking collaboration on innovative fintech projects. Reasons for match: Common interest in fintech industry, Both looking for project collaboration. Would you like me to make an introduction?"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Need to expand my startup network",
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found a great networking match for you! @username is also interested in Entrepreneurship, Technology. Their networking goal is: Looking to connect with other founders for potential partnerships. Reasons for match: Shared entrepreneurial focus, Complementary technology interests. Would you like me to make an introduction?"
                },
            },
        ]
    ] as ActionExample[][],
};