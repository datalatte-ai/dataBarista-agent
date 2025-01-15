import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, State } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { MatchIntention, MatchIntentionCache } from "../types";
import { REQUIRED_FIELDS } from "../constants";

const extractionTemplate = `
TASK: Extract professional networking preferences from the conversation.

Recent messages:
{{recentMessages}}

Current known information:
{{currentInfo}}

Extract any new information about:
1. Their networking goals (Vibing with similar people, finding users, seeking job, finding partners, finding collaborators, seeking grants or intevstments, hiring talents, learning from expewrts, seeking advise, investing, or ask for more accurate description.)
2. Professional Interests (AI, AI agents, privacy, data rights, DeFi, AiFi, etc.)

Format the response as an array of objects with the following structure:
[{
    "networkingGoal": string | null,
    "industryPreference": string[] | null
}]

Only include information that was explicitly mentioned in the conversation.
Return an empty array if no new information was found.
`;

export const matchIntentionEvaluator: Evaluator = {
    name: "matchIntentionEvaluator",
    similes: ["EXTRACT_NETWORKING_PREFERENCES", "GET_PROFESSIONAL_PREFERENCES"],
    description: "Extracts and stores user's professional networking intentions and preferences",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;
            const cached = await runtime.cacheManager.get<MatchIntentionCache>(cacheKey);
            return !cached?.data?.completed;
        } catch (error) {
            console.error("Error in matchIntentionEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            // Get current data from cache
            const cached = await runtime.cacheManager.get<MatchIntentionCache>(cacheKey);
            const currentData: MatchIntention = cached?.data || { completed: false };

            // Prepare state for extraction
            const extractionState: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                recentMessages: message.content.text,
                currentInfo: JSON.stringify(currentData, null, 2),
                senderName: username,
                agentName: runtime.character.name,
                actorsData: [],
                recentMessagesData: [],
                roomId: message.roomId,
                actors: ""
            };

            const context = composeContext({
                template: extractionTemplate,
                state: extractionState
            });

            const results = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!results?.length) {
                return false;
            }

            const extractedData = results[0];

            // Merge existing data with new data
            const newData: MatchIntention = {
                networkingGoal: extractedData.networkingGoal || currentData.networkingGoal,
                industryPreference: extractedData.industryPreference || currentData.industryPreference,
                completed: false
            };

            // Check if all required fields are present
            const isComplete = REQUIRED_FIELDS.every(field => newData[field]);
            if (isComplete) {
                newData.completed = true;
            }

            // Store updated data in cache
            const cacheData: MatchIntentionCache = {
                data: newData,
                lastUpdated: Date.now()
            };

            await runtime.cacheManager.set(cacheKey, cacheData, {
                expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 week
            });

            return true;
        } catch (error) {
            console.error("Error in matchIntentionEvaluator handler:", error);
            return false;
        }
    },

    examples: [
        {
            context: "Conversation about professional networking preferences",
            messages: [
                {
                    user: "User",
                    content: {
                        text: "I'm looking to find people who like privacy and data rights in web3 space"
                    }
                },
                {
                    user: "dataBarista",
                    content: {
                        text: "What kind of networking opportunity are you looking for specifically?"
                    }
                },
                {
                    user: "User",
                    content: {
                        text: "Mainly technical collaboration and possibly mentorship on open source projects"
                    }
                }
            ],
            outcome: "Extracted interests in privacy and data rights in web3 space and networking goal (technical collaboration and possibly mentorship with privacy and data rights focus)"
        }
    ]
};
