import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, State, elizaLogger, composeContext, generateObject } from "@elizaos/core";
import { ProfessionalProfile, UserProfileCache } from "../types";
import { extractionTemplate, profileToJsonLdTemplate } from "../templates";
import { INITIAL_PROFILE } from '../constants';
import { isProfileReadyForDKG } from '../utils';
// @ts-ignore
import DKG from "dkg.js";

let DkgClient: any = null;

export const professionalProfileEvaluator: Evaluator = {
    name: "professionalProfileEvaluator",
    similes: ["EXTRACT_PROFESSIONAL_PROFILE", "GET_NETWORKING_PREFERENCES", "ANALYZE_BACKGROUND"],
    description: "Extracts and maintains professional profile information through stateful conversation processing",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            elizaLogger.info("Validating professionalProfileEvaluator", {
                username,
                messageId: message.id,
                messageContent: message.content.text.substring(0, 100) + "..."
            });

            // Validate DKG environment variables if needed
            const requiredEnvVars = [
                "DKG_ENVIRONMENT",
                "DKG_HOSTNAME",
                "DKG_PORT",
                "DKG_BLOCKCHAIN_NAME",
                "DKG_PUBLIC_KEY",
                "DKG_PRIVATE_KEY",
            ];

            const missingVars = requiredEnvVars.filter(
                (varName) => !runtime.getSetting(varName)
            );

            if (missingVars.length > 0) {
                elizaLogger.warn(
                    `Missing DKG environment variables: ${missingVars.join(", ")}. DKG integration will be skipped.`
                );
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in professionalProfileEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            // Get or initialize profile
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);
            const currentProfile = cached?.data || INITIAL_PROFILE;

            // Handle platform account if new user
            if (!cached?.data && message.content.source) {
                const platform = message.content.source.toLowerCase() as "telegram" | "twitter";
                if (Object.keys(runtime.clients).includes(platform)) {
                    currentProfile.platformAccounts.push({ platform, username });
                }
            }

            // Prepare state for extraction
            if (!state) {
                state = await runtime.composeState(message);
            }
            state = await runtime.updateRecentMessageState(state);

            // Extract new information
            const context = composeContext({
                template: extractionTemplate,
                state: {
                    ...state,
                    currentProfile: JSON.stringify(currentProfile, null, 2),
                }
            });

            const result = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!result || Object.keys(result).length === 0) {
                return false;
            }

            // Merge new information with current profile
            const newInfo = result[0];
            const mergedProfile = mergeProfiles(currentProfile, newInfo);

            // Check if profile is ready for DKG
            if (isProfileReadyForDKG(mergedProfile)) {
                try {
                    // Initialize DKG client if needed
                    if (!DkgClient) {
                        DkgClient = new DKG({
                            environment: runtime.getSetting("DKG_ENVIRONMENT"),
                            endpoint: runtime.getSetting("DKG_HOSTNAME"),
                            port: runtime.getSetting("DKG_PORT"),
                            blockchain: {
                                name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
                                publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
                                privateKey: runtime.getSetting("DKG_PRIVATE_KEY"),
                            },
                            maxNumberOfRetries: 300,
                            frequency: 2,
                            contentType: "all",
                            nodeApiVersion: "/v1",
                        });
                    }

                    // Test with DKG-compatible JSON-LD
                    const testJsonLd = {
                        "@context": "http://schema.org",
                        "@type": "SocialMediaPosting",
                        "@id": "https://www.linkedin.com/in/johndoe",
                        "headline": "Professional Profile: AI Agent Developer Search",
                        "articleBody": "Looking for senior AI agent developers with Masters degree",
                        "about": [{
                            "@type": "Thing",
                            "@id": "http://schema.org/AITechnology",
                            "name": "AI Agent Development",
                            "url": "http://schema.org/AITechnology"
                        }],
                        "keywords": [{
                            "@type": "Text",
                            "@id": "tag:ai-agents",
                            "name": "AI Agents"
                        }, {
                            "@type": "Text",
                            "@id": "tag:senior-developer",
                            "name": "Senior Developer"
                        }]
                    };

                    const PrivatetestJsonLd = {
                        "@context": "http://schema.org",
                        "@type": "SocialMediaPosting",
                        "@id": "https://www.linkedin.com/in/johndoe",
                        "headline": "A very private message",
                        "articleBody": "PRIVATE nodboy should be able to see this",
                    };

                    elizaLogger.info("Test JSON-LD:", {
                        testJsonLd
                    });

                    // Publish to DKG
                    elizaLogger.info("Publishing profile to DKG with client config:", {
                        environment: runtime.getSetting("DKG_ENVIRONMENT"),
                        endpoint: runtime.getSetting("DKG_HOSTNAME"),
                        port: runtime.getSetting("DKG_PORT"),
                        blockchain: runtime.getSetting("DKG_BLOCKCHAIN_NAME")
                    });

                    let createAssetResult;
                    try {
                        elizaLogger.log("Publishing message to DKG");

                        createAssetResult = await DkgClient.asset.create(
                            {
                                public: testJsonLd,
                                private: PrivatetestJsonLd
                            },
                            { epochsNum: 12 }
                        );



                        elizaLogger.log("=== Personal Knowledge Asset Created ===");
                        elizaLogger.log(`UAL: ${createAssetResult.UAL}`);
                        elizaLogger.log(`DKG Explorer Link: ${runtime.getSetting("DKG_ENVIRONMENT") === 'mainnet' ?
                                        'https://dkg.origintrail.io/explore?ual=' :
                                        'https://dkg-testnet.origintrail.io/explore?ual='}${createAssetResult.UAL}`);
                        elizaLogger.log("==========================================");

                    } catch (error) {
                        elizaLogger.error(
                            "Error occurred while publishing message to DKG:",
                            error.message
                        );

                        if (error.stack) {
                            elizaLogger.error("Stack trace:", error.stack);
                        }
                        if (error.response) {
                            elizaLogger.error(
                                "Response data:",
                                JSON.stringify(error.response.data, null, 2)
                            );
                        }
                        throw error; // Re-throw to be caught by outer catch block
                    }

                } catch (error) {
                    elizaLogger.error("Error in DKG publishing:", {
                        error: error.message,
                        type: error.constructor.name
                    });
                }
            }

            // Save updated profile
            const cacheData: UserProfileCache = {
                data: mergedProfile,
                extractionState: {
                    currentProfile: mergedProfile,
                    conversationHistory: [...(cached?.extractionState?.conversationHistory || []), message.content.text]
                },
                lastUpdated: Date.now()
            };

            await runtime.cacheManager.set(cacheKey, cacheData);

            elizaLogger.info("Profile updated", {
                    username,
                hasNewPersonal: !!newInfo.personal,
                hasNewIntention: !!newInfo.intention,
                finalProfile: JSON.stringify(mergedProfile, null, 2)
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error in professionalProfileEvaluator handler:", error);
            return false;
        }
    },

    examples: []
};

function mergeProfiles(current: ProfessionalProfile, newInfo: any): ProfessionalProfile {
    const merged = { ...current };

        // Merge personal information
    if (newInfo.personal) {
        merged.personal = {
            ...merged.personal,
            ...newInfo.personal,
            // Merge arrays without duplicates
            skills: [...new Set([...(merged.personal.skills || []), ...(newInfo.personal.skills || [])])],
            industries: [...new Set([...(merged.personal.industries || []), ...(newInfo.personal.industries || [])])],
            locations: [...new Set([...(merged.personal.locations || []), ...(newInfo.personal.locations || [])])],
            interests: [...new Set([...(merged.personal.interests || []), ...(newInfo.personal.interests || [])])]
        };
    }

    // Update intention
    if (newInfo.intention) {
        merged.intention = {
            type: newInfo.intention.type || merged.intention.type,
            description: newInfo.intention.description || merged.intention.description,
            preferences: {
                ...merged.intention.preferences,
                ...newInfo.intention.preferences,
                // Merge array fields without duplicates
                requiredSkills: [...new Set([
                    ...(merged.intention.preferences.requiredSkills || []),
                    ...(newInfo.intention.preferences?.requiredSkills || [])
                ])],
                preferredIndustries: [...new Set([
                    ...(merged.intention.preferences.preferredIndustries || []),
                    ...(newInfo.intention.preferences?.preferredIndustries || [])
                ])],
                locationPreferences: [...new Set([
                    ...(merged.intention.preferences.locationPreferences || []),
                    ...(newInfo.intention.preferences?.locationPreferences || [])
                ])]
            }
        };
    }

    return merged;
}