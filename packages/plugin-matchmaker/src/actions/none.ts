import {
    ActionExample,
    IAgentRuntime,
    Memory,
    type Action,
} from "@elizaos/core";

export const noneAction: Action = {
    name: "NONE",
    similes: [
        "NO_ACTION",
        "NO_RESPONSE",
        "NO_REACTION",
        "RESPONSE",
        "REPLY",
        "DEFAULT",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description:
        "Respond but perform no additional action. This is the default if the agent is speaking and not doing anything additional.",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory
    ): Promise<boolean> => {
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Hey whats up" },
            },
            {
                user: "{{user2}}",
                content: { text: "oh hey", action: "NONE" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "hows the weather where ur at",
                    action: "NONE",
                },
            },
            {
                user: "{{user2}}",
                content: { text: "beautiful all week", action: "NONE" },
            },
        ],
    ] as ActionExample[][],
} as Action;
