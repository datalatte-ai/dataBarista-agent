import { elizaLogger } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

// Helper to ensure UUID is properly formatted
function generateUUID(): `${string}-${string}-${string}-${string}-${string}` {
    return uuidv4() as `${string}-${string}-${string}-${string}-${string}`;
}

const AGENT_ID = "34595365-cab6-0d4e-80be-4e590a7ffc71"; // From agent startup logs

const syntheticConversations = [
    {
        userId: generateUUID(),
        username: "test_eventpro",
        messages: [
            "Hi! I'm an Event Director looking to modernize our tech stack. We run large-scale events with 10,000+ attendees and I'm interested in using AI to enhance the attendee experience.",
            "I'm based in San Francisco and have been in the events industry for over 8 years. Currently working with a growth-stage events management company that's raised Series A funding.",
            "My expertise is in event planning, community building, and venue management. I've managed events for Fortune 500 companies and major tech conferences.",
            "We're specifically looking for technology partners who can help us scale our events and improve attendee engagement. Open to revenue sharing or partnership models with a timeline of 3-6 months for initial pilot.",
            "Our ideal partners would be AI/tech companies in the Bay Area or remote, preferably with experience in large-scale event management. We're particularly interested in companies that have proven success in enterprise deployments.",
            "Budget-wise, we're looking at investing $50-100k in the initial phase, with potential for larger scale deployment across our event portfolio."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_tech_founder_sarah",
        messages: [
            "Hello! I'm Sarah, founder of an AI startup in the computer vision space. We're developing real-time crowd analytics and flow optimization technology.",
            "We're a seed-stage company based in Boston, with a team of 15 people including 8 ML engineers. We've raised $2M in seed funding and are looking to expand into the events industry.",
            "My background includes 5 years at Google working on computer vision projects and 3 years running my current startup. I have a PhD in Computer Science from MIT.",
            "We're actively seeking partnerships with event organizers to pilot our technology. Our goal is to secure 2-3 major event partnerships in the next quarter for real-world validation.",
            "Specifically interested in connecting with organizers of conferences, music festivals, or sports events with attendance of 5000+ people. Location preference is US East Coast or remote collaboration.",
            "We can offer revenue sharing models and are willing to customize our solution for the right partner. Looking for long-term strategic partnerships with potential for equity arrangements."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_healthcare_innovator",
        messages: [
            "Hi, I'm a Healthcare Technology Director at a major hospital network. We're looking to implement AI solutions for patient care optimization and workflow automation.",
            "I have 12 years of experience in healthcare IT, previously led digital transformation projects at Kaiser Permanente, and hold an MBA in Healthcare Management.",
            "Our focus is on improving patient outcomes while reducing administrative burden on our medical staff. We're particularly interested in NLP and automation solutions.",
            "We have a budget of $200-300k for pilot projects and are looking for startups or established companies with HIPAA-compliant AI solutions.",
            "Ideal partners would have experience in healthcare, understand regulatory requirements, and can demonstrate clear ROI in similar implementations.",
            "Location isn't a constraint, but we prefer partners who can provide on-site support during critical phases of implementation."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_fintech_founder",
        messages: [
            "Hello! I'm the founder of a fintech startup focusing on democratizing access to investment opportunities through AI-powered analytics.",
            "We're a team of 10 with strong backgrounds in finance and machine learning. Currently post-seed with $3M raised, looking to expand our product offerings.",
            "My background includes 7 years at Goldman Sachs in quantitative trading and 3 years building this startup. I hold a Masters in Financial Engineering from Berkeley.",
            "Seeking partnerships with data providers, financial institutions, or complementary fintech companies to enhance our platform's capabilities.",
            "We're particularly interested in companies working on alternative data analysis, risk assessment, or regulatory compliance technology.",
            "Open to various collaboration models including API integration, white-labeling, or joint venture opportunities."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_sustainability_expert",
        messages: [
            "Hi, I'm an Environmental Sustainability Consultant working with Fortune 500 companies on their net-zero initiatives.",
            "I have 15 years of experience in environmental science and corporate sustainability. Previously led sustainability programs at Unilever and Patagonia.",
            "Looking to connect with cleantech startups or established companies that can help large corporations track and reduce their carbon footprint.",
            "We need partners who can provide scalable solutions for emissions tracking, supply chain optimization, and sustainability reporting.",
            "Ideal collaborators would have experience with ESG metrics, carbon accounting, and can handle enterprise-scale deployments.",
            "Budget ranges from $100-500k per implementation, depending on scope. Timeline is typically 6-12 months for full deployment."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_retail_innovator",
        messages: [
            "Hello! I'm the Innovation Director at a major retail chain with 500+ locations across North America.",
            "We're looking to implement AI solutions for inventory management, customer experience, and supply chain optimization.",
            "My background includes 10 years in retail operations and 5 years leading digital transformation initiatives. MBA from Wharton.",
            "Seeking technology partners who can help us compete with e-commerce giants through smart retail solutions.",
            "Particularly interested in computer vision for inventory tracking, predictive analytics for demand forecasting, and personalization technology.",
            "We have a $1M+ innovation budget and are looking for partners who can scale across our entire network of stores."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_edtech_pioneer",
        messages: [
            "Hi! I'm the founder of an educational technology platform focused on personalized learning through AI.",
            "We serve over 100,000 students globally and are looking to enhance our platform with advanced AI capabilities.",
            "I have a PhD in Education from Stanford and previously worked at Khan Academy developing adaptive learning systems.",
            "Looking for partners in AI/ML who can help us build better personalization algorithms and learning path optimization.",
            "Interested in companies working on NLP, knowledge mapping, or adaptive assessment technologies.",
            "We have secured Series A funding and can allocate $200-400k for the right partnership opportunity."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_manufacturing_expert",
        messages: [
            "Hello, I'm the Operations Director at a smart manufacturing company specializing in Industry 4.0 solutions.",
            "We're implementing AI and IoT solutions in manufacturing plants to improve efficiency and reduce downtime.",
            "Background includes 20 years in manufacturing, specializing in process optimization and automation. Six Sigma Black Belt certified.",
            "Looking for partners who can provide predictive maintenance, quality control, or supply chain optimization solutions.",
            "Ideal partners would have experience with industrial IoT, machine learning for manufacturing, and real-time analytics.",
            "We have several pilot opportunities with budgets ranging from $150-300k per implementation."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_legal_tech_innovator",
        messages: [
            "Hi, I'm a Partner at a major law firm leading our legal technology innovation initiative.",
            "We're looking to implement AI solutions for contract analysis, legal research, and case prediction.",
            "I have 15 years of legal experience and a strong interest in how AI can transform legal services.",
            "Seeking partnerships with legal tech startups or AI companies that can help automate routine legal work.",
            "Particularly interested in NLP solutions for document analysis and AI tools for legal research and compliance.",
            "We have a dedicated innovation budget of $500k and are looking for long-term technology partners."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_agtech_researcher",
        messages: [
            "Hello! I'm a Senior Researcher at an agricultural technology institute focused on sustainable farming.",
            "We're working on implementing AI and robotics in agriculture for crop optimization and resource management.",
            "My background includes 10 years in agricultural science and 5 years in AI/ML applications for farming.",
            "Looking for partners in computer vision, robotics, or predictive analytics for agricultural applications.",
            "Interested in solutions for crop disease detection, yield prediction, or autonomous farming equipment.",
            "We have several grants totaling $1M+ for technology implementation in partner farms."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_gaming_director",
        messages: [
            "Hi! I'm the Creative Director at an indie game studio working on AI-enhanced gaming experiences.",
            "We're developing next-gen games that use AI for procedural content generation and dynamic storytelling.",
            "I have 12 years in game development, previously worked at Ubisoft and Epic Games on AAA titles.",
            "Looking for partnerships with AI companies that can help us push the boundaries of interactive entertainment.",
            "Particularly interested in natural language processing for NPC interactions and generative AI for content.",
            "We're backed by major gaming investors and have $300k allocated for AI technology partnerships."
        ]
    },
    {
        userId: generateUUID(),
        username: "test_smart_city_planner",
        messages: [
            "Hello! I'm an Urban Innovation Director working on smart city initiatives for a major metropolitan area.",
            "We're implementing AI solutions for traffic management, energy optimization, and public service delivery.",
            "My background includes 15 years in urban planning and 5 years leading smart city projects.",
            "Seeking technology partners who can provide solutions for urban mobility, sustainability, and citizen services.",
            "Particularly interested in IoT integration, predictive analytics for city services, and citizen engagement platforms.",
            "We have secured government funding of $2M+ for innovative urban technology implementations."
        ]
    }
];

async function sendMessage(message: {
    userId: string;
    username: string;
    text: string;
    roomId: string;
}) {
    const response = await fetch(`http://localhost:3000/${AGENT_ID}/message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId: message.userId,
            username: message.username,
            text: message.text,
            roomId: message.roomId,
            platform: "telegram",
            source: "telegram",
            characterId: AGENT_ID,
            name: message.username,
            userName: message.username
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    elizaLogger.debug("Message response:", data);
    return data;
}

async function simulateConversation(conversation: typeof syntheticConversations[0]) {
    elizaLogger.info(`Simulating conversation for user: ${conversation.username}`);

    const roomId = generateUUID();

    // Send each message in sequence
    for (const message of conversation.messages) {
        try {
            await sendMessage({
                userId: conversation.userId,
                username: conversation.username,
                text: message,
                roomId
            });
            elizaLogger.info(`Sent message for ${conversation.username}:`, message);

            // Wait a bit between messages to let processing complete
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            elizaLogger.error(`Error sending message for ${conversation.username}:`, error);
            throw error;
        }
    }
}

async function simulateAllConversations() {
    try {
        // Simulate each conversation
        for (const conversation of syntheticConversations) {
            await simulateConversation(conversation);
            // Wait between conversations
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        elizaLogger.info("Finished simulating all conversations");

    } catch (error) {
        elizaLogger.error("Error in simulation:", error);
        if (error instanceof Error) {
            elizaLogger.error("Error stack:", error.stack);
        }
        process.exit(1);
    }
}

// Run the simulation
simulateAllConversations();