import { Evaluator, IAgentRuntime, Memory, ModelClass, generateObjectArray, State, elizaLogger, generateText } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { personalKnowledgeTemplate } from "../constants";
import { DkgClient } from "@elizaos/plugin-dkg";

const extractionTemplate = `
TASK: Extract comprehensive professional and personal information from the conversation.

Recent messages:
{{recentMessages}}

Current known information:
{{currentInfo}}

Please analyze the conversation and extract structured information about the person's professional background and interests.
Focus on these specific aspects:

1. Professional Identity:
- Current job title and company
- Industry sector
- Years of experience
- Key responsibilities

2. Skills and Expertise:
- Technical skills (with proficiency levels: Beginner/Intermediate/Expert)
- Soft skills
- Domain expertise
- Areas of knowledge

3. Professional Development:
- Career goals
- Learning interests
- Areas where they seek mentorship
- Areas where they can mentor others

4. Networking Preferences:
- Type of connections they're seeking
- Preferred interaction methods
- Availability and schedule constraints
- Geographic location and language preferences

Format the response as an array with a single object. For each field, include:
- The extracted value
- A confidence score (0.0-1.0)
- The reasoning for the extraction (what led to this conclusion)
Only include fields where information was found (omit null/empty fields).

Example structure:
[{
    "jobInfo": {
        "title": {
            "value": "Senior Software Engineer",
            "confidence": 0.95,
            "reasoning": "Explicitly stated in message: 'I'm a senior software engineer'"
        },
        // other job fields similarly structured
    },
    "skills": [
        {
            "name": "Python",
            "type": "technical",
            "proficiency": "Expert",
            "confidence": 0.9,
            "reasoning": "User mentioned ability to mentor in Python, suggesting expert-level proficiency"
        }
    ],
    "expertise": [
        {
            "domain": "Machine Learning",
            "level": "Advanced",
            "confidence": 0.85,
            "reasoning": "Has 8 years of experience in AI and machine learning, currently working in the field"
        }
    ],
    "development": {
        "careerGoals": [
            {
                "value": "Research Collaboration",
                "confidence": 0.9,
                "reasoning": "Explicitly seeking to connect with AI researchers for collaboration"
            }
        ],
        // other development fields similarly structured
    },
    "networking": {
        "goals": {
            "value": "Research Collaboration",
            "confidence": 0.95,
            "reasoning": "Explicitly stated desire to connect with AI researchers for collaboration"
        },
        // other networking fields similarly structured
    }
}]

Only extract information that can be supported by specific evidence from the conversation.
For each field:
1. Include a confidence score based on how directly the information was stated or how strongly it can be inferred
2. Provide specific reasoning that references the exact part of the conversation that led to this conclusion
3. Omit any fields where you don't have sufficient evidence to make a reasonable inference
4. Use direct quotes from the conversation in reasoning where possible

Return an empty array if no meaningful information was found.`;

async function constructPersonalKnowledgeAsset(runtime: IAgentRuntime, extractedData: any, username: string) {
    const context = `
    You are tasked with creating a structured knowledge graph object for storing personal professional information.
    Your goal is to transform the extracted information into the provided template structure.

    ** Template **
    The knowledge graph should follow this structure:
    ${JSON.stringify(personalKnowledgeTemplate, null, 2)}

    ** Input Data **
    This data includes confidence scores and reasoning for each field.
    ${JSON.stringify({
        ...extractedData,
        username: username
    }, null, 2)}

    ** Instructions **
    1. Use "${username}" as the identifier and for the @id field (prefix with uuid:)
    2. Transform all extracted information into the corresponding template fields
    3. For each field that has a confidence score and reasoning:
       - Add the confidence score to the field object
       - Add the reasoning as a 'evidence' property
    4. Generate unique UUIDs for each entity using meaningful prefixes
    5. Only include fields that have actual data with sufficient confidence (> 0.5)
    6. Ensure all fields follow schema.org vocabulary where applicable
    7. For arrays of items (skills, expertise, etc.), include confidence and evidence for each item
    8. Make sure to use the provided username in both @id and identifier fields

    ** Output **
    Generate the knowledge graph in the exact JSON-LD format provided above, extended with confidence scores and evidence.
    Make sure to only output the JSON-LD object. DO NOT OUTPUT ANYTHING ELSE.
    `;

    const content = await generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });

    const knowledgeGraph = JSON.parse(content.replace(/```json|```/g, ""));

    // Ensure username is set correctly
    knowledgeGraph["@id"] = `uuid:${username}`;
    knowledgeGraph.identifier = username;

    // Set current timestamps
    const now = new Date().toISOString();
    knowledgeGraph.dateCreated = now;
    knowledgeGraph.lastUpdated = now;

    // Add metadata about the knowledge extraction
    knowledgeGraph.metadata = {
        "@type": "DataFeedItem",
        "dateCreated": now,
        "description": "Personal knowledge graph extracted from conversation",
        "provider": {
            "@type": "Organization",
            "name": "Eliza Matchmaker"
        }
    };

    return knowledgeGraph;
}

export const matchIntentionEvaluator: Evaluator = {
    name: "matchIntentionEvaluator",
    similes: ["EXTRACT_PROFESSIONAL_PROFILE", "GET_NETWORKING_PREFERENCES", "ANALYZE_BACKGROUND"],
    description: "Extracts and stores comprehensive professional and networking information",

    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        return true; // Always validate since we want to continuously update preferences
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            const username = state?.senderName || message.userId;
            if (!username) {
                elizaLogger.error("No username found in state or message");
                return false;
            }

            elizaLogger.log(`Processing knowledge extraction for user: ${username}`);

            // Prepare state for extraction
            const extractionState: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                recentMessages: message.content.text,
                currentInfo: "{}",
                senderName: username,
                agentName: runtime.character.name,
                actorsData: [],
                recentMessagesData: [],
                roomId: message.roomId,
                actors: ""
            };

            const context = composeContext({
                template: extractionTemplate,
                state: extractionState
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

            // Check if we have any meaningful data
            if (!extractedData || Object.keys(extractedData).length === 0) {
                return false;
            }

            // Transform data into knowledge graph structure
            const knowledgeGraph = await constructPersonalKnowledgeAsset(runtime, extractedData, username);

            // Store in DKG
            elizaLogger.log("Publishing personal knowledge to DKG");
            elizaLogger.log("Knowledge Graph to publish:", JSON.stringify(knowledgeGraph, null, 2));

            try {
                const createAssetResult = await DkgClient.asset.create(
                    {
                        public: knowledgeGraph,
                    },
                    { epochsNum: 12 }
                );

                elizaLogger.log("=== Personal Knowledge Asset Created ===");
                elizaLogger.log(`UAL: ${createAssetResult.UAL}`);
                elizaLogger.log(`DKG Explorer Link: ${process.env.OT_ENVIRONMENT === 'mainnet' ?
                    'https://dkg.origintrail.io/explore?ual=' :
                    'https://dkg-testnet.origintrail.io/explore?ual='}${createAssetResult.UAL}`);
                elizaLogger.log("==========================================");

                return true;
            } catch (error) {
                elizaLogger.error("Error creating DKG asset:", {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    knowledgeGraph
                });
                return false;
            }

        } catch (error) {
            elizaLogger.error("Error in matchIntentionEvaluator handler:", error);
            return false;
        }
    },

    examples: [
        {
            context: "Conversation between a user and agent about networking goals and preferences",
            messages: [
                {
                    user: "User",
                    content: {
                        text: "I'm a senior software engineer with 8 years of experience in AI and machine learning. Currently working at TechCorp, looking to connect with other AI researchers for collaboration on open source projects. I'm particularly interested in LLMs and can mentor in Python and deep learning. Available for meetings on weekday evenings, based in London."
                    }
                }
            ],
            outcome: "Extracted comprehensive professional profile including job details, skills, expertise, mentorship areas, and networking preferences"
        }
    ]
};
