import { IAgentRuntime, Memory, Provider } from "@elizaos/core";
import { MatchPool, MatchPoolCache, MatchIntention, MatchIntentionCache } from "../types";

const POOL_CACHE_KEY = "matchmaker/pool";
const ACTIVE_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const matchPoolProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        try {
            // Get current user's match intention
            const userCacheKey = `${runtime.character.name}/${message.userId}/data`;
            const userIntentionCache = await runtime.cacheManager.get<MatchIntentionCache>(userCacheKey);

            if (!userIntentionCache?.data) {
                return "No matching profile found. Please complete your networking preferences first.";
            }

            // Get or initialize pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>(POOL_CACHE_KEY);
            let pool = poolCache?.pools || [];

            // Get username from actors data
            const actorsData = await runtime.databaseAdapter.getParticipantsForRoom(message.roomId);
            const userData = await runtime.databaseAdapter.getAccountById(message.userId);
            const username = userData?.username;

            if (!username) {
                return "Unable to find username. Please ensure your account is properly connected.";
            }

            // Update/add current user to pool
            const currentUser: MatchPool = {
                userId: message.userId, // UUID for internal reference
                username: username, // For introductions
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
            await runtime.cacheManager.set(POOL_CACHE_KEY, {
                pools: pool,
                lastUpdated: now
            }, {
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