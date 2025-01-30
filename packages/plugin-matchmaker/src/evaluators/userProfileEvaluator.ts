import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, generateText, State, elizaLogger, composeContext } from "@elizaos/core";
import dotenv from "dotenv";
dotenv.config();
// @ts-ignore
import DKG from "dkg.js";

const extractionTemplate = `
Extract the user's (goal & preference) plus their (background personal information) including their demographic, interests, skills, experience and behavior.

Recent messages:
{{recentMessages}}

Format each  with:
- category (goal & preference, background personal information)
- name (specific detail)
- confidence (0.0-1.0)
- evidence (why you think this is an interest)

Example output:
{
    "interests": [
        {
            "category": "technology",
            "name": "AI Development",
            "confidence": 0.9,
            "evidence": "User explicitly states they are an AI agent developer"
        }
    ]
}

Only include interests that have clear evidence from the conversation.`;

async function constructKnowledgeGraph(runtime: IAgentRuntime, extractedData: any, username: string) {
    // Convert the simple interest format to JSON-LD
    const knowledgeGraph = {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": `uuid:${username}`,
        "identifier": username,
        "dateCreated": new Date().toISOString(),
        "lastModified": new Date().toISOString(),
        "hasInterest": [],
        "metadata": {
            "@type": "DataFeedItem",
            "dateCreated": new Date().toISOString(),
            "provider": {
                "@type": "Organization",
                "name": "Eliza Matchmaker"
            }
        }
    };

    if (extractedData?.interests && Array.isArray(extractedData.interests)) {
        knowledgeGraph.hasInterest = extractedData.interests
            .filter(interest => interest.confidence > 0.5)
            .map(interest => ({
                "@type": "Thing",
                "name": interest.name,
                "additionalProperty": [
                    {
                        "@type": "PropertyValue",
                        "name": "category",
                        "value": interest.category
                    },
                    {
                        "@type": "PropertyValue",
                        "name": "confidence",
                        "value": interest.confidence
                    },
                    {
                        "@type": "PropertyValue",
                        "name": "evidence",
                        "value": interest.evidence
                    }
                ]
            }));
    }

    elizaLogger.info("Constructed knowledge graph:", knowledgeGraph);
    return knowledgeGraph;
}

export const userProfileEvaluator: Evaluator = {
    name: "userProfileEvaluator",
    similes: ["EXTRACT_INTERESTS", "GET_INTERESTS", "ANALYZE_INTERESTS"],
    description: "Extracts and stores user interests in DKG",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        return true; // Always validate to continuously update interests
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            if (!username) {
                elizaLogger.error("No username found in state or message");
                return false;
            }

            // Get recent conversation history
            if (!state) {
                state = await runtime.composeState(message);
            }
            state = await runtime.updateRecentMessageState(state);

            // Prepare state for extraction
            const extractionState: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                recentMessages: state.recentMessages || message.content.text,
                currentInfo: "{}",
                senderName: username,
                agentName: runtime.character.name,
                roomId: message.roomId,
                actors: state.actors || "",
                actorsData: [],
                recentMessagesData: []
            };

            const context = composeContext({
                template: extractionTemplate,
                state: extractionState
            });

            elizaLogger.info("Starting interest extraction for user:", { username });

            const results = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!results?.length) {
                elizaLogger.warn("No interests extracted");
                return false;
            }

            const extractedData = results[0];
            elizaLogger.info("Extracted interests:", { extractedData });

            // Transform to knowledge graph
            const knowledgeGraph = await constructKnowledgeGraph(runtime, extractedData, username);
            elizaLogger.info("Constructed knowledge graph:", { knowledgeGraph });

            // Initialize DKG client with minimal retries
            try {
                // Load environment variables
                const envVars = {
                    environment: process.env.OT_ENVIRONMENT || 'testnet',
                    endpoint: process.env.OT_NODE_HOSTNAME || 'https://v6-pegasus-node-02.origin-trail.network',
                    port: parseInt(process.env.OT_NODE_PORT || '8900', 10),
                    blockchain: {
                        name: process.env.OT_BLOCKCHAIN_NAME || 'gnosis:10200',
                        publicKey: process.env.OT_PUBLIC_KEY,
                        privateKey: process.env.OT_PRIVATE_KEY,
                    },
                    maxNumberOfRetries: 2,
                    frequency: 1,
                    contentType: "all",
                    nodeApiVersion: "/v1"
                };

                elizaLogger.info("DKG Environment Variables:", {
                    environment: envVars.environment,
                    endpoint: envVars.endpoint,
                    port: envVars.port,
                    blockchain: {
                        name: envVars.blockchain.name,
                        publicKey: envVars.blockchain.publicKey ? '[REDACTED]' : undefined,
                        privateKey: '[REDACTED]'
                    }
                });

                // Check for required blockchain credentials
                if (!envVars.blockchain.publicKey || !envVars.blockchain.privateKey) {
                    throw new Error('Missing required DKG blockchain credentials (OT_PUBLIC_KEY and/or OT_PRIVATE_KEY)');
                }

                const dkgClient = new DKG(envVars);

                elizaLogger.info("Creating DKG asset...");

                try {
                    const createAssetResult = await dkgClient.asset.create(
                        {
                            public: knowledgeGraph,
                        },
                        { epochsNum: 12 }
                    );

                    if (!createAssetResult?.UAL) {
                        throw new Error('DKG asset created but no UAL returned');
                    }

                    const explorerLink = `${envVars.environment === 'mainnet' ?
                        'https://dkg.origintrail.io/explore?ual=' :
                        'https://dkg-testnet.origintrail.io/explore?ual='}${createAssetResult.UAL}`;

                    elizaLogger.info("Knowledge graph published to DKG:", {
                        UAL: createAssetResult.UAL,
                        explorerLink
                    });

                    return true;
                } catch (assetError) {
                    elizaLogger.error("Error creating DKG asset:", {
                        error: {
                            name: assetError.name,
                            message: assetError.message,
                            stack: assetError.stack
                        },
                        config: {
                            environment: envVars.environment,
                            endpoint: envVars.endpoint,
                            port: envVars.port,
                            blockchain: envVars.blockchain.name
                        }
                    });
                    throw assetError;
                }
            } catch (error) {
                elizaLogger.error("Error with DKG operations:", {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    knowledgeGraph
                });
                // Continue even if DKG fails - we still extracted the interests
                return true;
            }

        } catch (error) {
            elizaLogger.error("Error in userProfileEvaluator handler:", error);
            return false;
        }
    },

    examples: [
        {
            context: "User discussing their interests",
            messages: [
                {
                    user: "User",
                    content: {
                        text: "I'm really into blockchain technology, especially Ethereum and DeFi. I also enjoy developing software and attending tech conferences."
                    }
                }
            ],
            outcome: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Person",
                "@id": "uuid:example_user",
                "identifier": "example_user",
                "dateCreated": "2024-01-23T12:00:00Z",
                "lastModified": "2024-01-23T12:00:00Z",
                "hasInterest": [
                    {
                        "@type": "Thing",
                        "category": "technology",
                        "about": "crypto",
                        "keywords": ["Ethereum", "DeFi", "blockchain"],
                        "metadata": {
                            "confidence": 0.9,
                            "evidence": "User explicitly mentions interest in Ethereum and DeFi technologies"
                        }
                    },
                    {
                        "@type": "Thing",
                        "category": "business & industry",
                        "about": "engineering",
                        "keywords": ["software development", "tech conferences"],
                        "metadata": {
                            "confidence": 0.8,
                            "evidence": "User mentions software development and attending tech conferences"
                        }
                    }
                ],
                "metadata": {
                    "@type": "DataFeedItem",
                    "provider": {
                        "@type": "Organization",
                        "name": "Eliza Matchmaker"
                    }
                }
            }, null, 2)
        }
    ]
};
