import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { MatchPool, MatchPoolCache, MatchIntention, MatchIntentionCache } from "../types";

const POOL_CACHE_KEY = "matchmaker/pool";
const ACTIVE_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const matchPoolProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const username = state?.senderName || message.userId;

            // Get current user's match intention
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            if (!userIntentionCache?.data) {
                return "No matching profile found yet in the pool. Please complete your networking preferences first.";
            }

            // Get or initialize pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>(POOL_CACHE_KEY);
            let pool = poolCache?.pools || [];

            // Get username from state or database
            let displayUsername = username;
            if (!state?.senderName) {
                const userData = await runtime.databaseAdapter.getAccountById(message.userId);
                displayUsername = userData?.username || username;
            }

            // Update/add current user to pool
            const currentUser: MatchPool = {
                userId: message.userId,
                username: displayUsername,
                matchIntention: userIntentionCache.data,
                lastActive: Date.now()
            };

            // Update pool with current user
            pool = pool.filter(p => p.userId !== message.userId);
            pool.push(currentUser);

            // Clean inactive users
            const now = Date.now();
            pool = pool.filter(p => (now - p.lastActive) < ACTIVE_THRESHOLD);

            // Save updated pool
            const poolCacheData: MatchPoolCache = {
                pools: pool,
                lastUpdated: now
            };

            await runtime.cacheManager.set(POOL_CACHE_KEY, poolCacheData, {
                expires: now + ACTIVE_THRESHOLD
            });

            // Return detailed pool information for matchScoreEvaluator
            return {
                currentUser: {
                    userId: currentUser.userId,
                    username: currentUser.username,
                    matchIntention: {
                        networkingGoal: currentUser.matchIntention.networkingGoal,
                        industryPreference: currentUser.matchIntention.industryPreference
                    }
                },
                potentialMatches: pool
                    .filter(p => p.userId !== message.userId)
                    .map(user => ({
                        userId: user.userId,
                        username: user.username,
                        matchIntention: {
                            networkingGoal: user.matchIntention.networkingGoal,
                            industryPreference: user.matchIntention.industryPreference
                        },
                        lastActive: user.lastActive
                    }))
            };
        } catch (error) {
            console.error("Error in matchPoolProvider:", error);
            return null;
        }
    }
};

export { matchPoolProvider };