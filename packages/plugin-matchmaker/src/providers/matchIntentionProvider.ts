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
Please start gathering the following information naturally in conversation:
- Their networking goals (mentorship, collaboration, business partnerships)
- Industry preferences they're interested in
`;
            }

            const { data } = cached;
            const missingFields = REQUIRED_FIELDS.filter(field => !data[field]);

            if (missingFields.length === 0 && data.completed) {
                return `
Professional Networking Profile for @${username}:
- Networking Goal: ${data.networkingGoal}
- Industries: ${data.industryPreference?.join(", ")}

Instructions for agent:
The networking profile is complete.
`;
            }

            return `
Current Networking Profile for @${username}:
${data.networkingGoal ? `- Networking Goal: ${data.networkingGoal}` : ""}
${data.industryPreference?.length ? `- Industries: ${data.industryPreference.join(", ")}` : ""}

Instructions for agent:
Please gather the following missing information naturally in conversation:
${missingFields.map(field => `- ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join('\n')}
`;
        } catch (error) {
            console.error("Error in matchIntentionProvider:", error);
            return null;
        }
    }
};

export { matchIntentionProvider };
