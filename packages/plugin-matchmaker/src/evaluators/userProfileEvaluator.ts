import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, State, elizaLogger } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { UserProfile, UserProfileCache } from "../types";
import { REQUIRED_FIELDS, NETWORKING_PURPOSES, RELATIONSHIP_TYPES, EXPERIENCE_LEVELS, COMPANY_STAGES } from "../constants";

const extractionTemplate = `
TASK: Extract comprehensive professional information from the conversation.

Recent messages:
{{recentMessages}}

Current known information:
{{currentInfo}}

Please analyze the conversation and extract information in these three categories:

1. Professional Context & Background
- Current role/position
- Industry/sector
- Experience level (entry/intermediate/senior/executive/expert)
- Company stage/size
- Geographic location/market focus
- Core expertise/specialization

2. Goals & Objectives
- Primary networking purpose
- Target outcomes
- Timeline/urgency
- Scale/scope of needs (funding amounts, market reach, etc.)
- Type of relationship sought (mentorship, partnership, investment, etc.)

3. Preferences & Requirements
- Preferred counterpart profiles (experience level, industry background)
- Geographic/market preferences
- Industry/sector focus
- Stage/maturity preferences
- Specific expertise needed
- Deal parameters (if applicable)

Format the response as an array with a single object containing these categories:
[{
    "professionalContext": {
        "role": string | null,
        "industry": string | null,
        "experienceLevel": string | null,
        "companyStage": string | null,
        "location": string | null,
        "expertise": string[] | null,
        "confidence": {
            "role": number,
            "industry": number,
            "experienceLevel": number,
            "companyStage": number,
            "location": number,
            "expertise": number
        }
    },
    "goalsObjectives": {
        "primaryPurpose": string | null,
        "targetOutcomes": string[] | null,
        "timeline": string | null,
        "scale": {
            "fundingAmount": string | null,
            "marketReach": string | null,
            "other": string | null
        } | null,
        "relationshipType": string[] | null,
        "confidence": {
            "primaryPurpose": number,
            "targetOutcomes": number,
            "timeline": number,
            "scale": number,
            "relationshipType": number
        }
    },
    "preferencesRequirements": {
        "counterpartProfiles": {
            "experienceLevel": string[] | null,
            "background": string[] | null
        } | null,
        "geographicPreferences": string[] | null,
        "industryFocus": string[] | null,
        "stagePreferences": string[] | null,
        "requiredExpertise": string[] | null,
        "dealParameters": {
            "investmentSize": string | null,
            "metrics": string[] | null,
            "other": string | null
        } | null,
        "confidence": {
            "counterpartProfiles": number,
            "geographicPreferences": number,
            "industryFocus": number,
            "stagePreferences": number,
            "requiredExpertise": number,
            "dealParameters": number
        }
    }
}]

For each field:
1. Include a confidence score (0.0-1.0) based on how directly the information was stated
2. Only include fields where information was found in the conversation
3. Use standardized values where applicable:
   - Experience levels: ${EXPERIENCE_LEVELS.join(", ")}
   - Company stages: ${COMPANY_STAGES.join(", ")}
   - Networking purposes: ${NETWORKING_PURPOSES.join(", ")}
   - Relationship types: ${RELATIONSHIP_TYPES.join(", ")}

Return an empty array if no meaningful information was found.`;

export const userProfileEvaluator: Evaluator = {
    name: "userProfileEvaluator",
    similes: ["EXTRACT_PROFESSIONAL_PROFILE", "GET_NETWORKING_PREFERENCES", "ANALYZE_BACKGROUND"],
    description: "Extracts and stores comprehensive professional and networking information",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);

            // Always validate to continuously update and refine the profile
            return true;
        } catch (error) {
            console.error("Error in userProfileEvaluator validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            const cacheKey = `${runtime.character.name}/${username}/data`;

            // 1. Get cached data
            const cached = await runtime.cacheManager.get<UserProfileCache>(cacheKey);
            const currentData: UserProfile = cached?.data || {
                professionalContext: {
                    role: null,
                    industry: null,
                    experienceLevel: null,
                    companyStage: null,
                    location: null,
                    expertise: null,
                    confidence: {}
                },
                goalsObjectives: {
                    primaryPurpose: null,
                    targetOutcomes: null,
                    timeline: null,
                    scale: null,
                    relationshipType: null,
                    confidence: {}
                },
                preferencesRequirements: {
                    counterpartProfiles: null,
                    geographicPreferences: null,
                    industryFocus: null,
                    stagePreferences: null,
                    requiredExpertise: null,
                    dealParameters: null,
                    confidence: {}
                },
                completed: false,
                lastUpdated: new Date().toISOString()
            };

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
                currentInfo: JSON.stringify(currentData, null, 2),
                senderName: username,
                agentName: runtime.character.name,
                actorsData: state.actorsData || [],
                recentMessagesData: state.recentMessagesData || [],
                roomId: message.roomId,
                actors: state.actors || ""
            };

            const context = composeContext({
                template: extractionTemplate,
                state: extractionState
            });

            elizaLogger.info("=== UserProfileEvaluator Started ===");
            elizaLogger.info("Input Context:", {
                username,
                recentMessages: state.recentMessages,
                currentData: JSON.stringify(currentData, null, 2)
            });

            elizaLogger.info("Composed Context:", context);

            const results = await generateObjectArray({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!results?.length) {
                elizaLogger.warn("UserProfileEvaluator: No results extracted");
                return false;
            }

            const extractedData = results[0];
            elizaLogger.info("Extracted Data:", JSON.stringify(extractedData, null, 2));

            // Merge existing data with new data, preserving highest confidence values
            const newData: UserProfile = {
                professionalContext: mergeWithConfidence(currentData.professionalContext, extractedData.professionalContext),
                goalsObjectives: mergeWithConfidence(currentData.goalsObjectives, extractedData.goalsObjectives),
                preferencesRequirements: mergeWithConfidence(currentData.preferencesRequirements, extractedData.preferencesRequirements),
                completed: false,
                lastUpdated: new Date().toISOString()
            };

            // Check if all required fields are present with sufficient confidence
            const isComplete = checkCompletion(newData);
            if (isComplete) {
                newData.completed = true;
            }

            elizaLogger.info("Final Result:", {
                username,
                isComplete,
                data: JSON.stringify(newData, null, 2)
            });
            elizaLogger.info("=== UserProfileEvaluator Completed ===");

            // Store updated data in cache
            const cacheData: UserProfileCache = {
                data: newData,
                lastUpdated: Date.now()
            };

            await runtime.cacheManager.set(cacheKey, cacheData);

            return true;
        } catch (error) {
            elizaLogger.error("Error in userProfileEvaluator handler:", error);
            return false;
        }
    },

    examples: []
    /*
    examples: [
        {
            context: "VC partner seeking investment opportunities",
            messages: [
                {
                    user: "User",
                    content: {
                        text: "Hello! I'm a partner at a VC firm looking to expand our portfolio in B2B SaaS and fintech startups. We focus on Series A, typically investing $3-8M in companies with proven product-market fit and at least $1M ARR. We primarily invest in North America and Europe, but we're open to remote-first teams as long as they're incorporated in these regions. We often co-invest and are always looking to expand our network of co-investors."
                    }
                }
            ],
            outcome: "Extracted profile of a VC partner focusing on Series A B2B SaaS and fintech startups in North America and Europe, investing $3-8M with specific metrics requirements, seeking both founders and co-investors"
        }
    ]
    */
};

function mergeWithConfidence<T extends { confidence: Record<string, number> }>(current: T, extracted: T): T {
    if (!extracted) return current;

    const merged = { ...current };

    // Merge each field, keeping the version with higher confidence
    Object.keys(extracted).forEach(key => {
        if (key === 'confidence') return;

        const currentConfidence = current.confidence[key] || 0;
        const extractedConfidence = extracted.confidence[key] || 0;

        if (extractedConfidence >= (currentConfidence - 0.2)) {
            merged[key] = extracted[key];
            merged.confidence[key] = Math.max(extractedConfidence, currentConfidence);
        }
    });

    return merged;
}

function checkCompletion(data: UserProfile): boolean {
    // Check if all required fields are present with confidence > 0.7
    const checkFields = (obj: any, fields: readonly string[]): boolean => {
        return fields.every(field => {
            const value = obj[field];
            const confidence = obj.confidence[field] || 0;
            return value && confidence > 0.7;
        });
    };

    return (
        checkFields(data.professionalContext, REQUIRED_FIELDS.professionalContext) &&
        checkFields(data.goalsObjectives, REQUIRED_FIELDS.goalsObjectives) &&
        checkFields(data.preferencesRequirements, REQUIRED_FIELDS.preferencesRequirements)
    );
}
