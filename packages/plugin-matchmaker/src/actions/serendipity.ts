import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
} from "@elizaos/core";
import { MatchPool } from "../types";

interface MatchResult {
    user: MatchPool;
    matchScore: {
        score: number;
        reasons: string[];
    };
}

interface StoredMatches {
    matches: MatchResult[];
    lastUpdated: number;
}

export const serendipityAction: Action = {
    name: "SERENDIPITY",
    description: "Notifies users when a compatible networking match is found and facilitates introduction via telegram usernames",
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

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const matchesKey = `${runtime.character.name}/${message.userId}/matches`;
            const storedMatches = await runtime.cacheManager.get<StoredMatches>(matchesKey);
            return !!storedMatches?.matches?.length;
        } catch (error) {
            console.error("Error in serendipity validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        try {
            const matchesKey = `${runtime.character.name}/${message.userId}/matches`;
            const storedMatches = await runtime.cacheManager.get<StoredMatches>(matchesKey);

            if (!storedMatches?.matches?.length) {
                return false;
            }

            // Get the best match and clear cache after processing
            const bestMatch = storedMatches.matches[0];
            await runtime.cacheManager.delete(matchesKey);

            return true;
        } catch (error) {
            console.error("Error in serendipity handler:", error);
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Looking for networking opportunities in tech" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I found someone who might be a great connection for you! They're a senior developer at a tech startup with expertise in AI and blockchain. Their match score is 90% based on your interests. Would you like to connect with @techmentor42?",
                    action: "SERENDIPITY"
                }
            },
            {
                user: "{{user1}}",
                content: { text: "Yes, that sounds perfect!" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Great! I'll let them know about your interest. They're particularly keen on mentoring in AI development.",
                    action: "NONE"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Any interesting matches today?" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Actually, yes! I found someone in the fintech industry who's looking to expand their professional network. They have an 85% match score with your interests. Their username is @blockchain_dev88 - would you like an introduction?",
                    action: "SERENDIPITY"
                }
            },
            {
                user: "{{user1}}",
                content: { text: "Not at the moment, thanks" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "No problem! I'll keep looking for other potential matches that better align with your current interests.",
                    action: "NONE"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Hey, I'm looking to connect with other startup founders" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Perfect timing! I just found a match with a startup founder in your industry. They're working on AI-powered analytics and looking to connect with other founders. Their username is @startup_founder99. The match score is 95% based on your shared interests and goals. Would you like me to facilitate an introduction?",
                    action: "SERENDIPITY"
                }
            },
            {
                user: "{{user1}}",
                content: { text: "Absolutely, please do!" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Excellent! I'll reach out to them with your information. They're particularly interested in discussing scaling strategies and AI implementation.",
                    action: "NONE"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Show me my matches" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I found a promising connection! They're a product manager with experience in AI and machine learning. Match score is 88% based on your shared interest in product development. Their username is @product_guru. Would you like to connect?",
                    action: "SERENDIPITY"
                }
            },
            {
                user: "{{user1}}",
                content: { text: "Can you tell me more about their background?" }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "They have 5 years of experience leading AI products and are looking to exchange insights about product development in the AI space. They're also interested in mentoring other product managers.",
                    action: "NONE"
                }
            }
        ]
    ] as ActionExample[][],
} as Action;