export const personalKnowledgeTemplate = {
    "@context": "http://schema.org",
    "@type": "Person",
    "@id": "uuid:<username>",
    "identifier": "<username>",
    "jobTitle": "<current job title>",
    "worksFor": {
        "@type": "Organization",
        "@id": "uuid:<company>",
        "name": "<company name>",
        "industry": "<industry sector>"
    },
    "yearsOfExperience": 0,
    "description": "<key responsibilities>",
    "knowsAbout": [
        {
            "@type": "Thing",
            "@id": "uuid:<expertise>",
            "name": "<domain name>",
            "proficiencyLevel": "<level>"
        }
    ],
    "skills": [
        {
            "@type": "DefinedTerm",
            "@id": "uuid:<skill>",
            "name": "<skill name>",
            "termCode": "technical|soft",
            "proficiencyLevel": "<Beginner|Intermediate|Expert>"
        }
    ],
    "seeks": {
        "@type": "Demand",
        "description": "<networking goal>",
        "about": [
            {
                "@type": "Thing",
                "@id": "uuid:<industry>",
                "name": "<industry name>"
            }
        ]
    },
    "learningInterests": [
        {
            "@type": "DefinedTerm",
            "@id": "uuid:<interest>",
            "name": "<interest area>"
        }
    ],
    "mentorshipAreas": {
        "canMentor": [
            {
                "@type": "Thing",
                "@id": "uuid:<mentor-area>",
                "name": "<area name>"
            }
        ],
        "seeksMentorship": [
            {
                "@type": "Thing",
                "@id": "uuid:<mentee-area>",
                "name": "<area name>"
            }
        ]
    },
    "availabilitySchedule": {
        "@type": "Schedule",
        "description": "<availability description>"
    },
    "location": {
        "@type": "Place",
        "name": "<location name>"
    },
    "knowsLanguage": [
        {
            "@type": "Language",
            "name": "<language name>"
        }
    ],
    "confidenceScores": {
        "@type": "PropertyValue",
        "skills": 0.0,
        "experience": 0.0,
        "interests": 0.0,
        "goals": 0.0
    },
    "dateCreated": "yyyy-mm-ddTHH:mm:ssZ",
    "lastUpdated": "yyyy-mm-ddTHH:mm:ssZ"
};