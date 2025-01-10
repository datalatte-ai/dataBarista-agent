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
1. Networking goals (mentorship, collaboration, business partnerships)
2. Industry preferences (specific industries they're interested in)

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

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const username = message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;
            const cached = await runtime.cacheManager.get<MatchIntentionCache>(cacheKey);
            return !cached?.data?.completed;
        } catch (error) {
            console.error("Error in matchIntentionEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const username = message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            const cached = await runtime.cacheManager.get<MatchIntentionCache>(cacheKey);
            const currentData = cached?.data || { completed: false };

            const state: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                recentMessages: message.content.text,
                currentInfo: JSON.stringify(currentData, null, 2),
                senderName: message.userId,
                agentName: runtime.character.name,
                actorsData: [],
                recentMessagesData: [],
                roomId: message.roomId,
                actors: "",
                recentMessagesContext: "",
                messageContext: "",
                postContext: "",
                preContext: ""
            };

            const context = composeContext({
                template: extractionTemplate,
                state
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
            const newData: MatchIntention = {
                ...currentData,
                ...extractedData,
                completed: false
            };

            const isComplete = REQUIRED_FIELDS.every(field => newData[field]);
            if (isComplete) {
                newData.completed = true;
            }

            await runtime.cacheManager.set(cacheKey, {
                data: newData,
                lastUpdated: Date.now()
            }, {
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
                        text: "I'm looking to connect with experienced tech leads in the AI industry"
                    }
                },
                {
                    user: "Agent",
                    content: {
                        text: "What kind of networking opportunity are you looking for specifically?"
                    }
                },
                {
                    user: "User",
                    content: {
                        text: "Mainly mentorship and possibly collaboration on open source projects"
                    }
                }
            ],
            outcome: "Extracted industry preference (AI) and networking goal (mentorship, collaboration)"
        }
    ]
};
