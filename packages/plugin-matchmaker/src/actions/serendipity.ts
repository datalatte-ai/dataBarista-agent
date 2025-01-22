import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    Content,
    ModelClass,
    generateObjectArray,
    composeContext,
    elizaLogger
} from "@elizaos/core";
import {
    MatchPool,
    MatchPoolCache,
    UserProfile,
    UserProfileCache,
    MatchHistory,
    MatchRecord
} from "../types";
import { REQUIRED_FIELDS, NETWORKING_PURPOSES, RELATIONSHIP_TYPES, EXPERIENCE_LEVELS, COMPANY_STAGES } from "../constants";
import { checkFields } from "../utils/validation";

export const serendipityAction: Action = {
    name: "SERENDIPITY",
    description: "Call this action when user has completed their profile and is searching for a match.",
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

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;

            // Get user's profile
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userProfileCache = await runtime.cacheManager.get<UserProfileCache>(userCacheKey);

            // Add debug logging
            elizaLogger.info("Serendipity Validation Check:", {
                username,
                hasCache: !!userProfileCache,
                profileData: userProfileCache?.data
            });

            // Check if profile exists
            if (!userProfileCache?.data) {
                elizaLogger.warn(`No profile found for user ${username}`);
                return false;
            }

            const data = userProfileCache.data;

            // Check minimum required fields for matchmaking
            const hasMinimumFields =
                // Professional Context: at least role and experience level
                data.professionalContext?.role &&
                data.professionalContext?.experienceLevel &&
                // Goals: at least primary purpose and relationship type
                data.goalsObjectives?.primaryPurpose &&
                data.goalsObjectives?.relationshipType?.length > 0 &&
                // Preferences: at least industry focus or required expertise
                (data.preferencesRequirements?.industryFocus?.length > 0 ||
                 data.preferencesRequirements?.requiredExpertise?.length > 0);

            elizaLogger.info("Profile validation result:", {
                username,
                hasMinimumFields,
                professionalContext: {
                    hasRole: !!data.professionalContext?.role,
                    hasExperience: !!data.professionalContext?.experienceLevel
                },
                goals: {
                    hasPurpose: !!data.goalsObjectives?.primaryPurpose,
                    hasRelationType: (data.goalsObjectives?.relationshipType?.length || 0) > 0
                },
                preferences: {
                    hasIndustryFocus: (data.preferencesRequirements?.industryFocus?.length || 0) > 0,
                    hasExpertise: (data.preferencesRequirements?.requiredExpertise?.length || 0) > 0
                }
            });

            if (!hasMinimumFields) {
                elizaLogger.warn(`User ${username} profile missing minimum required fields`);
                return false;
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in serendipity validate:", error);
            return false;
        }
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<Content | void> => {
        try {
            const username = state?.senderName || message.userId;
            elizaLogger.info("=== Starting Serendipity Matchmaking ===");
            elizaLogger.info(`Processing match request for user: ${username}`);

            // Get user's profile
            const userCacheKey = `${runtime.character.name}/${username}/data`;
            const userProfileCache = await runtime.cacheManager.get<UserProfileCache>(userCacheKey);

            if (!userProfileCache?.data) {
                elizaLogger.warn(`No profile found for user ${username}`);
                return;
            }

            const data = userProfileCache.data;
            // Check minimum required fields for matchmaking
            const hasMinimumFields =
                // Professional Context: at least role and experience level
                data.professionalContext?.role &&
                data.professionalContext?.experienceLevel &&
                // Goals: at least primary purpose and relationship type
                data.goalsObjectives?.primaryPurpose &&
                data.goalsObjectives?.relationshipType?.length > 0 &&
                // Preferences: at least industry focus or required expertise
                (data.preferencesRequirements?.industryFocus?.length > 0 ||
                 data.preferencesRequirements?.requiredExpertise?.length > 0);

            if (!hasMinimumFields) {
                elizaLogger.warn(`User ${username} profile missing minimum required fields - skipping matchmaking`);
                return;
            }

            // Get username from state or database
            let displayUsername = username;
            if (!state?.senderName) {
                const userData = await runtime.databaseAdapter.getAccountById(message.userId);
                displayUsername = userData?.username || username;
            }

            // Create current user object with lastActive
            const currentUser: MatchPool = {
                userId: message.userId,
                username: displayUsername,
                matchIntention: userProfileCache.data,
                lastActive: Date.now(),
                contactInfo: undefined // Optional field
            };

            // Get existing match pool
            const poolCache = await runtime.cacheManager.get<MatchPoolCache>("matchmaker/pool");
            elizaLogger.info("Cache details:", {
                cacheType: runtime.cacheManager.constructor.name,
                poolCache: poolCache,
                poolSize: poolCache?.pools?.length || 0,
                currentUser: currentUser
            });
            const matchPool = poolCache?.pools || [];

            elizaLogger.info(`Found ${matchPool.length} potential candidates in match pool`);

            // Update current user in the pool
            const updatedPool = [
                ...matchPool.filter(p => p.userId !== message.userId),
                currentUser
            ];

            // Store updated pool
            await runtime.cacheManager.set("matchmaker/pool", {
                pools: updatedPool,
                lastUpdated: Date.now()
            });

            elizaLogger.info("Starting match evaluation process...");
            let matchesEvaluated = 0;
            let highQualityMatches = 0;

            // Find potential matches among users with completed profiles
            for (const potentialMatch of matchPool) {
                // Skip self-matching
                if (potentialMatch.userId === message.userId) {
                    elizaLogger.debug(`Skipping self-match for user: ${potentialMatch.username}`);
                    continue;
                }

                // Check minimum fields for potential match
                const matchData = potentialMatch.matchIntention;
                const matchHasMinimumFields =
                    matchData.professionalContext?.role &&
                    matchData.professionalContext?.experienceLevel &&
                    matchData.goalsObjectives?.primaryPurpose &&
                    matchData.goalsObjectives?.relationshipType?.length > 0 &&
                    (matchData.preferencesRequirements?.industryFocus?.length > 0 ||
                     matchData.preferencesRequirements?.requiredExpertise?.length > 0);

                if (!matchHasMinimumFields) {
                    elizaLogger.debug(`Skipping incomplete profile for user: ${potentialMatch.username}`, {
                        profile: matchData
                    });
                    continue;
                }

                elizaLogger.info(`Evaluating potential match: ${potentialMatch.username}`, {
                    matchProfile: matchData
                });
                matchesEvaluated++;

                const evaluationState = {
                    currentProfile: {
                        username: displayUsername,
                        matchIntention: userProfileCache.data
                    },
                    potentialMatch: {
                        username: potentialMatch.username,
                        matchIntention: potentialMatch.matchIntention
                    },
                    // Required state fields
                    bio: "",
                    lore: "",
                    messageDirections: "",
                    postDirections: "",
                    recentMessages: "",
                    senderName: username,
                    agentName: runtime.character.name,
                    actorsData: [],
                    recentMessagesData: [],
                    roomId: message.roomId,
                    actors: ""
                };

                const matchEvaluationTemplate = `
TASK: Extract match compatibility information and return a structured assessment.

Input Profiles:
Profile 1: ${evaluationState.currentProfile.username}
- Role: ${evaluationState.currentProfile.matchIntention.professionalContext.role}
- Industry: ${evaluationState.currentProfile.matchIntention.professionalContext.industry}
- Goals: ${evaluationState.currentProfile.matchIntention.goalsObjectives?.targetOutcomes?.join(", ")}

Profile 2: ${evaluationState.potentialMatch.username}
- Role: ${evaluationState.potentialMatch.matchIntention.professionalContext.role}
- Industry: ${evaluationState.potentialMatch.matchIntention.professionalContext.industry}
- Goals: ${evaluationState.potentialMatch.matchIntention.goalsObjectives?.targetOutcomes?.join(", ")}

Return an array containing exactly one match evaluation object with the following structure:
[{
    "isMatch": boolean,      // true or false
    "matchScore": number,    // between 0.0 and 1.0
    "reasons": [
        string,             // at least one reason required
        string              // additional reasons optional
    ],
    "complementaryFactors": [
        string,             // at least one factor required
        string              // additional factors optional
    ],
    "potentialSynergies": [
        string,             // at least one synergy required
        string              // additional synergies optional
    ]
}]

IMPORTANT:
1. Return ONLY the JSON array
2. Use proper JSON syntax with double quotes for strings
3. Include commas between array elements
4. Do not include trailing commas
5. Do not include any text before or after the JSON array
6. Ensure all fields are present and properly typed

Example of valid response:
[{
    "isMatch": true,
    "matchScore": 0.85,
    "reasons": [
        "Strong alignment in event technology",
        "Complementary expertise in AI and events"
    ],
    "complementaryFactors": [
        "Technical expertise meets industry experience",
        "Product development meets market access"
    ],
    "potentialSynergies": [
        "Joint development of AI-powered event solutions",
        "Access to enterprise event market"
    ]
}]`;

                const context = composeContext({
                    template: matchEvaluationTemplate,
                    state: evaluationState
                });

                // Add retry limit and tracking
                let retryCount = 0;
                const MAX_RETRIES = 2;

                while (retryCount <= MAX_RETRIES) {
                    try {
                        elizaLogger.info("Sending match evaluation request to model...");

                        const results = await generateObjectArray({
                            runtime,
                            context,
                            modelClass: ModelClass.LARGE
                        });

                        // Log raw model response
                        elizaLogger.info("Raw model response:", {
                            results: results ? JSON.stringify(results, null, 2) : "null",
                            type: typeof results
                        });

                        // Validate the results format
                        if (!results?.length || !Array.isArray(results)) {
                            elizaLogger.error("Invalid results format:", {
                                results: results,
                                type: typeof results,
                                isArray: Array.isArray(results),
                                length: results?.length
                            });
                            retryCount++;
                            continue;
                        }

                        const matchResult = results[0];
                        elizaLogger.info("Processing match result:", {
                            matchResult: JSON.stringify(matchResult, null, 2)
                        });

                        // Validate object structure
                        if (!matchResult || typeof matchResult !== 'object') {
                            elizaLogger.error(`Invalid match result format - not an object (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
                            retryCount++;
                            continue;
                        }

                        // Validate all required fields exist and have correct types
                        const requiredFields = {
                            isMatch: 'boolean',
                            matchScore: 'number',
                            reasons: 'array',
                            complementaryFactors: 'array',
                            potentialSynergies: 'array'
                        };

                        const isValid = Object.entries(requiredFields).every(([field, type]) => {
                            const value = matchResult[field];
                            const actualType = Array.isArray(value) ? 'array' : typeof value;
                            if (actualType !== type) {
                                elizaLogger.warn(`Invalid type for ${field}: expected ${type}, got ${actualType}`);
                                return false;
                            }
                            if (type === 'array' && !value.length) {
                                elizaLogger.warn(`Empty array not allowed for ${field}`);
                                return false;
                            }
                            return true;
                        });

                        if (!isValid) {
                            retryCount++;
                            continue;
                        }

                        // Validate matchScore range
                        if (matchResult.matchScore < 0 || matchResult.matchScore > 1) {
                            elizaLogger.warn(`Invalid match score - must be between 0 and 1: ${matchResult.matchScore} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
                            retryCount++;
                            continue;
                        }

                        // If we get here, we have a valid result
                        if (matchResult.isMatch) {
                            elizaLogger.info("Valid match found:", {
                                username: potentialMatch.username,
                                score: matchResult.matchScore,
                                reasons: matchResult.reasons,
                                complementaryFactors: matchResult.complementaryFactors,
                                potentialSynergies: matchResult.potentialSynergies
                            });

                            if (matchResult.matchScore >= 0.6) {
                                highQualityMatches++;
                                elizaLogger.info("High quality match found, preparing notification...");

                                // Store match and prepare notification
                                const matchCacheKey = `matchmaker/matches/${message.userId}`;
                                const existingMatches = await runtime.cacheManager.get<MatchHistory>(matchCacheKey) || { matches: [] };

                                const newMatch: MatchRecord = {
                                    userId: potentialMatch.userId,
                                    username: potentialMatch.username,
                                    matchedAt: Date.now(),
                                    matchScore: matchResult.matchScore,
                                    reasons: matchResult.reasons,
                                    complementaryFactors: matchResult.complementaryFactors,
                                    potentialSynergies: matchResult.potentialSynergies,
                                    status: 'pending'
                                };

                                elizaLogger.info("Storing match data:", { matchCacheKey, newMatch });

                                await runtime.cacheManager.set(matchCacheKey, {
                                    matches: [...existingMatches.matches, newMatch],
                                    lastUpdated: Date.now()
                                });

                                const matchDescription = formatMatchDescription(potentialMatch, matchResult);
                                elizaLogger.info("Match description prepared:", { matchDescription });

                                elizaLogger.info("=== Serendipity Matchmaking Complete ===");
                                elizaLogger.info(`Summary: Evaluated ${matchesEvaluated} candidates, found ${highQualityMatches} high quality matches`);

                                // Return immediately with match notification
                                return {
                                    text: matchDescription,
                                    action: "SERENDIPITY"
                                };
                            } else {
                                elizaLogger.info("Match score too low:", {
                                    username: potentialMatch.username,
                                    score: matchResult.matchScore
                                });
                            }
                        } else {
                            elizaLogger.info("No match:", {
                                username: potentialMatch.username,
                                isMatch: matchResult.isMatch,
                                score: matchResult.matchScore
                            });
                        }
                        // Break retry loop on valid result
                        break;

                    } catch (error) {
                        if (error instanceof SyntaxError && error.message.includes('JSON')) {
                            elizaLogger.error("JSON parsing error in match evaluation:", {
                                error: error.message,
                                attempt: `${retryCount + 1}/${MAX_RETRIES + 1}`,
                                stack: error.stack
                            });
                        } else {
                            elizaLogger.error("Error in match evaluation:", {
                                error: error.message,
                                type: error.constructor.name,
                                attempt: `${retryCount + 1}/${MAX_RETRIES + 1}`,
                                stack: error.stack
                            });
                        }
                        retryCount++;
                        if (retryCount > MAX_RETRIES) {
                            elizaLogger.error(`Max retries (${MAX_RETRIES + 1}) reached for ${potentialMatch.username}, moving to next candidate`);
                            break;
                        }
                    }
                }
            }

            elizaLogger.info("=== Serendipity Matchmaking Complete ===");
            elizaLogger.info(`Summary: Evaluated ${matchesEvaluated} candidates, found ${highQualityMatches} high quality matches`);

            return;
        } catch (error) {
            elizaLogger.error("Error in serendipity handler:", error);
            return;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I'm a Series A startup founder in healthtech looking for investors",
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found a highly promising match (Match Score: 0.9)! @healthtechVC is a Partner at HealthTech Ventures focusing on Series A investments in digital health. They invest $3-8M in companies with proven product-market fit.\n\nKey Alignments:\n- Industry Focus: Healthcare Technology\n- Stage Match: Series A\n- Investment Range: Matches your needs\n- Geographic Coverage: North America\n\nComplementary Factors:\n- Their expertise in digital health monetization\n- Strong network of healthcare providers\n- Track record of successful exits in healthtech\n\nWould you like me to make an introduction?"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I'm a senior data scientist looking to transition into computer vision",
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found an excellent match (Match Score: 0.85)! @aimentor is a Technical Director at Vision AI Labs with 15+ years in computer vision. They're actively mentoring professionals transitioning into AI/CV roles.\n\nKey Alignments:\n- Expertise: Computer Vision, Deep Learning\n- Career Stage: Senior Technical Leadership\n- Mentorship Focus: AI/ML Career Transitions\n- Industry: Tech/AI\n\nComplementary Factors:\n- Experience hiring and building CV teams\n- Strong industry connections\n- Recent experience guiding similar transitions\n\nWould you like me to facilitate an introduction?"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Looking for co-investors in B2B SaaS",
                    action: "SERENDIPITY"
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "I found a great co-investment match (Match Score: 0.95)! @saasVC is a Managing Partner at SaaS Capital, focusing on B2B software investments at Series A/B stages.\n\nKey Alignments:\n- Investment Focus: B2B SaaS\n- Stage Preference: Series A/B\n- Check Size: $5-10M\n- Geographic Focus: Global, remote-first\n\nComplementary Factors:\n- Strong enterprise software expertise\n- Complementary portfolio companies\n- History of successful co-investments\n\nShall I make an introduction?"
                },
            },
        ]
    ] as ActionExample[][],
};

function formatMatchDescription(matchPool: MatchPool, matchResult: any): string {
    const matchIntention = matchPool.matchIntention;
    const roleDescription = matchIntention.professionalContext.role
        ? `${matchIntention.professionalContext.role} at ${matchIntention.professionalContext.companyStage} company`
        : "professional";

    const industryDescription = matchIntention.professionalContext.industry
        ? `in ${matchIntention.professionalContext.industry}`
        : "";

    const expertiseDescription = matchIntention.professionalContext.expertise?.length
        ? `specializing in ${matchIntention.professionalContext.expertise.join(", ")}`
        : "";

    const locationDescription = matchIntention.professionalContext.location
        ? `based in ${matchIntention.professionalContext.location}`
        : "";

    const primaryPurpose = matchIntention.goalsObjectives.primaryPurpose
        ? `Their primary goal is ${matchIntention.goalsObjectives.primaryPurpose}`
        : "";

    return `I found a promising match (Match Score: ${matchResult.matchScore.toFixed(2)})! @${matchPool.username} is a ${roleDescription} ${industryDescription} ${expertiseDescription} ${locationDescription}.\n\n${primaryPurpose}\n\nKey Alignments:\n${matchResult.reasons.map(r => `- ${r}`).join("\n")}\n\nComplementary Factors:\n${matchResult.complementaryFactors.map(f => `- ${f}`).join("\n")}\n\nPotential Synergies:\n${matchResult.potentialSynergies.map(s => `- ${s}`).join("\n")}\n\nWould you like me to facilitate an introduction?`;
}