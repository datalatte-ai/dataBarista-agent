import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { MatchIntention, MatchIntentionCache } from "../types";
import { REQUIRED_FIELDS } from "../constants";

const matchIntentionProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            const cached = await runtime.cacheManager.get<MatchIntentionCache>(cacheKey);

            if (!cached?.data) {
                return `
No networking profile found for @${username}.

Instructions for agent:
Please start gathering the following information naturally in conversation without overwelming the user with many options but rather a natural conversations and follow ups:
- Their networking goals (Vibing with similar people, finding users, seeking job, finding partners, finding collaborators, seeking grants or intevstments, hiring talents, learning from expewrts, seeking advise, investing, or ask for more accurate description.)
- Professional Interests (AI, AI agents, privacy, data rights, DeFi, AiFi, etc.)
`;
            }

            const { data } = cached;
            const missingFields = REQUIRED_FIELDS.filter(field => !data[field]);

            if (missingFields.length === 0 && data.completed) {
                return `
Professional Networking Profile for @${username} is complete, please proceed to matchmaking by calling SERENDIPITY action.:
- Networking Goal: ${data.networkingGoal}
- Interests: ${data.industryPreference?.join(", ")}
`;
            }

            return `
Current Networking Profile for @${username}:
${data.networkingGoal ? `- Networking Goal: ${data.networkingGoal}` : ""}
${data.industryPreference?.length ? `- Interests: ${data.industryPreference.join(", ")}` : ""}

Instructions for agent:
Please gather the following missing information naturally in conversation:
(Context about all the fields: - Their networking goals (Vibing with similar people, finding users, seeking job, finding partners, finding collaborators, seeking grants or intevstments, hiring talents, learning from expewrts, seeking advise, investing, or ask for more accurate description.) - Professional Interests (AI, AI agents, privacy, data rights, DeFi, AiFi, etc.))
${missingFields.map(field => `- ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join('\n')}
`;
        } catch (error) {
            console.error("Error in matchIntentionProvider:", error);
            return null;
        }
    }
};

export { matchIntentionProvider };
