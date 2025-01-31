import { ProfessionalProfile } from './types';

export function isProfileReadyForDKG(profile: ProfessionalProfile): boolean {
    // Count non-empty personal fields
    const personalFields = Object.entries(profile.personal)
        .filter(([_, value]) => {
            if (Array.isArray(value)) {
                return value.length > 0;
            }
            return value && value.toString().trim() !== '';
        });

    // Check intention type
    const hasIntentionType = profile.intention.type && profile.intention.type.trim() !== '';

    // Check if at least one preference is set
    const hasPreference = Object.values(profile.intention.preferences)
        .some(value => {
            if (Array.isArray(value)) {
                return value.length > 0;
            }
            return value && value.toString().trim() !== '';
        });

    return personalFields.length >= 2 && hasIntentionType && hasPreference;
}