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

            // Only proceed if user has completed their profile
            if (!userProfileCache?.data?.completed) {
                return false;
            }

            // No need to check pool since we'll directly compare with other completed profiles
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

            if (!userProfileCache?.data?.completed) {
                elizaLogger.warn(`User ${username} has incomplete profile - skipping matchmaking`);
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
                if (potentialMatch.userId === message.userId) continue;

                // Skip if profile not completed
                if (!potentialMatch.matchIntention?.completed) {
                    elizaLogger.debug(`Skipping incomplete profile for user: ${potentialMatch.username}`);
                    continue;
                }

                elizaLogger.info(`Evaluating potential match: ${potentialMatch.username}`);
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
TASK: Evaluate if these users would be a good professional networking match.

Current User:
Username: ${evaluationState.currentProfile.username}
Professional Context:
- Role: ${evaluationState.currentProfile.matchIntention.professionalContext.role}
- Industry: ${evaluationState.currentProfile.matchIntention.professionalContext.industry}
- Experience: ${evaluationState.currentProfile.matchIntention.professionalContext.experienceLevel}
- Company Stage: ${evaluationState.currentProfile.matchIntention.professionalContext.companyStage}
- Location: ${evaluationState.currentProfile.matchIntention.professionalContext.location}
- Expertise: ${evaluationState.currentProfile.matchIntention.professionalContext.expertise?.join(", ")}

Goals & Objectives:
- Primary Purpose: ${evaluationState.currentProfile.matchIntention.goalsObjectives.primaryPurpose}
- Target Outcomes: ${evaluationState.currentProfile.matchIntention.goalsObjectives.targetOutcomes?.join(", ")}
- Relationship Type: ${evaluationState.currentProfile.matchIntention.goalsObjectives.relationshipType?.join(", ")}

Preferences & Requirements:
- Geographic Preferences: ${evaluationState.currentProfile.matchIntention.preferencesRequirements.geographicPreferences?.join(", ")}
- Industry Focus: ${evaluationState.currentProfile.matchIntention.preferencesRequirements.industryFocus?.join(", ")}
- Stage Preferences: ${evaluationState.currentProfile.matchIntention.preferencesRequirements.stagePreferences?.join(", ")}
- Required Expertise: ${evaluationState.currentProfile.matchIntention.preferencesRequirements.requiredExpertise?.join(", ")}

Potential Match:
Username: ${evaluationState.potentialMatch.username}
Professional Context:
- Role: ${evaluationState.potentialMatch.matchIntention.professionalContext.role}
- Industry: ${evaluationState.potentialMatch.matchIntention.professionalContext.industry}
- Experience: ${evaluationState.potentialMatch.matchIntention.professionalContext.experienceLevel}
- Company Stage: ${evaluationState.potentialMatch.matchIntention.professionalContext.companyStage}
- Location: ${evaluationState.potentialMatch.matchIntention.professionalContext.location}
- Expertise: ${evaluationState.potentialMatch.matchIntention.professionalContext.expertise?.join(", ")}

Goals & Objectives:
- Primary Purpose: ${evaluationState.potentialMatch.matchIntention.goalsObjectives.primaryPurpose}
- Target Outcomes: ${evaluationState.potentialMatch.matchIntention.goalsObjectives.targetOutcomes?.join(", ")}
- Relationship Type: ${evaluationState.potentialMatch.matchIntention.goalsObjectives.relationshipType?.join(", ")}

Preferences & Requirements:
- Geographic Preferences: ${evaluationState.potentialMatch.matchIntention.preferencesRequirements.geographicPreferences?.join(", ")}
- Industry Focus: ${evaluationState.potentialMatch.matchIntention.preferencesRequirements.industryFocus?.join(", ")}
- Stage Preferences: ${evaluationState.potentialMatch.matchIntention.preferencesRequirements.stagePreferences?.join(", ")}
- Required Expertise: ${evaluationState.potentialMatch.matchIntention.preferencesRequirements.requiredExpertise?.join(", ")}

Format the response as an array of objects with the following structure:
[{
    "isMatch": boolean,
    "matchScore": number,
    "reasons": string[],
    "complementaryFactors": string[],
    "potentialSynergies": string[]
}]

Consider:
1. Professional Context Alignment
   - Industry overlap
   - Experience level compatibility
   - Geographic feasibility
   - Expertise complementarity

2. Goals & Objectives Alignment
   - Matching networking purposes
   - Compatible relationship types
   - Aligned timelines and scale
   - Mutual benefit potential

3. Preferences & Requirements Match
   - Geographic preferences alignment
   - Industry focus overlap
   - Stage preferences compatibility
   - Required expertise match

Calculate matchScore (0.0-1.0) based on:
- High impact matches (0.8-1.0): Perfect alignment in key areas
- Good matches (0.6-0.8): Strong alignment with minor differences
- Moderate matches (0.4-0.6): Some alignment with complementary factors
- Low matches (<0.4): Minimal alignment

Return an empty array if you cannot make a determination.
`;

                const context = composeContext({
                    template: matchEvaluationTemplate,
                    state: evaluationState
                });

                const results = await generateObjectArray({
                    runtime,
                    context,
                    modelClass: ModelClass.LARGE
                });

                if (results?.[0]?.isMatch) {
                    elizaLogger.info(`Match found with ${potentialMatch.username}:`, {
                        score: results[0].matchScore,
                        reasons: results[0].reasons
                    });

                    if (results[0].matchScore >= 0.6) {
                        highQualityMatches++;
                        elizaLogger.info(`High quality match (${results[0].matchScore}) with ${potentialMatch.username}`);

                        // Store the match data
                        const matchCacheKey = `matchmaker/matches/${message.userId}`;
                        const existingMatches = await runtime.cacheManager.get<MatchHistory>(matchCacheKey) || { matches: [] };

                        const newMatch: MatchRecord = {
                            userId: potentialMatch.userId,
                            username: potentialMatch.username,
                            matchedAt: Date.now(),
                            matchScore: results[0].matchScore,
                            reasons: results[0].reasons,
                            complementaryFactors: results[0].complementaryFactors,
                            potentialSynergies: results[0].potentialSynergies,
                            status: 'pending'
                        };

                        await runtime.cacheManager.set(matchCacheKey, {
                            matches: [...existingMatches.matches, newMatch],
                            lastUpdated: Date.now()
                        });

                        // Format match notification
                        const matchDescription = formatMatchDescription(potentialMatch, results[0]);

                        const response: Content = {
                            text: matchDescription,
                            action: "SERENDIPITY"
                        };

                        elizaLogger.info("=== Serendipity Matchmaking Complete ===");
                        elizaLogger.info(`Summary: Evaluated ${matchesEvaluated} candidates, found ${highQualityMatches} high quality matches`);

                        return response;
                    } else {
                        elizaLogger.debug(`Match score too low (${results[0].matchScore}) with ${potentialMatch.username}`);
                    }
                } else {
                    elizaLogger.debug(`No match with ${potentialMatch.username}`);
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