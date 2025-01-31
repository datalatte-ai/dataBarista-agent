import { ProfessionalProfile } from './types';

export const INITIAL_PROFILE: ProfessionalProfile = {
    platformAccounts: [],
    personal: {
        skills: [],
        industries: [],
        locations: [],
        interests: []
    },
    intention: {
        type: "",
        description: "",
        preferences: {}
    }
};
