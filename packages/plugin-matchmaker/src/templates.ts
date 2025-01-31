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
