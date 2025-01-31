export const extractionTemplate = `
TASK: Extract professional profile attributes and focused intentions from conversation history.

Recent Messages:
{{recentMessages}}

Current Profile:
{{currentProfile}}

Format response as array of objects following this schema:
[{
    "personal": {
        // Current occupation status
        "currentPosition"?: {
            "title"?: string,
            "company"?: string,
            "industry"?: string,
            "status"?: "actively-looking" | "employed" | "freelancing" | "founder" | "student"
        },
        // Core professional attributes
        "skills"?: string[],
        "industries"?: string[],
        "experienceLevel"?: "entry" | "mid" | "senior" | "executive",
        "locations"?: string[],
        // Additional context
        "education"?: string[],
        "certifications"?: string[],
        "languages"?: string[]
    },
    "intention": {
        "type": "mentorship" | "networking" | "collaboration" | "seeking_job"
          | "hiring" | "funding" | "startup_growth" | "skill_development"
          | "consulting" | "speaking_opportunity",
        "description": string,
        "preferences": {
            "requiredSkills"?: string[],
            "preferredIndustries"?: string[],
            "experienceLevel"?: "entry" | "mid" | "senior" | "executive",
            "locationPreferences"?: string[],
            "remotePreference"?: "onsite" | "remote" | "hybrid",
            "contractType"?: "full-time" | "part-time" | "freelance" | "internship",
            "compensationRange"?: [number, number],
            "companySize"?: "startup" | "small" | "medium" | "large"
        }
    }
}]

Rules:
1. Extract current position from explicit statements ("I work at...", "Currently employed as...")
2. Derive status from context if not explicitly stated
3. Company names should be normalized to official names (e.g., "Google" not "big tech company")
4. Maintain previous extraction rules

Example Response:
[{
    "personal": {
        "currentPosition": {
            "title": "senior ai engineer",
            "company": "OpenAI",
            "industry": "artificial intelligence",
            "status": "employed"
        },
        "skills": ["llm fine-tuning", "python", "vector-databases"],
        "certifications": ["AWS Machine Learning Specialty"]
    },
    "intention": {
        "type": "collaboration",
        "description": "looking to collaborate on ai safety research projects",
        "preferences": {
            "requiredSkills": ["ai alignment", "python"],
            "companySize": "startup"
        }
    }
}]

Output an empty array if no new information found: [{}]`;



export const profileToJsonLdTemplate = `
You are tasked with converting a professional profile into JSON-LD format following a specific SHACL schema.
The profile contains personal information, platform accounts, and professional intentions.

** Input Profile **
{{profile}}

** SHACL Schema **
@prefix schema: <http://schema.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix datalatte: <http://datalatte.com/ns#> .

The profile should be converted to JSON-LD following these class and property definitions:
1. schema:Person for professional background
2. schema:OnlineAccount for platform accounts
3. datalatte:Intention for goals and preferences

** Instructions **
1. Create a JSON-LD object with proper @context and @type
2. Convert personal information to schema:Person properties
3. Convert platform accounts to schema:OnlineAccount objects
4. Convert intentions to datalatte:Intention objects
5. Ensure all properties match the SHACL schema definitions
6. Generate appropriate UUIDs for @id values
7. Include all relevant data in a single public section

** Output Format **
{
    "@context": {
      "schema": "http://schema.org/",
      "foaf": "http://xmlns.com/foaf/0.1/",
      "datalatte": "http://datalatte.com/ns#"
    },
    "@type": "schema:Person",
    "@id": "urn:uuid:...",
    "datalatte:intention": {
      "@type": "datalatte:Intention",
      "@id": "urn:uuid:...",
      "datalatte:goal": ["string"],
      "datalatte:preferences": {
        "requiredSkills": ["string"],
        "preferredIndustries": ["string"],
        "experienceLevel": "string",
        "locationPreferences": ["string"],
        "remotePreference": "string"
    },
    "schema:role": "string",
    "schema:skills": ["string"],
    "schema:industries": ["string"],
    "schema:experienceLevel": "string",
    "schema:currentCompany": "string",
    "schema:education": ["string"],
    "schema:OnlineAccount": {
      "@type": "schema:OnlineAccount",
      "@id": "urn:uuid:...",
      "schema:accountPlatform": "string",
      "schema:accountUsername": "string"
    }
}

Generate only the JSON-LD object. DO NOT OUTPUT ANYTHING ELSE.
`;