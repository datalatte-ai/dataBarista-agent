import { v4 as uuidv4 } from 'uuid';

export type DKGId = `${string}-${string}-${string}-${string}-${string}`;

export function generateDKGId(): DKGId {
    return uuidv4() as DKGId;
}

export function generateProfileId(): DKGId {
    return generateDKGId();
}

export function generateIntentionId(): DKGId {
    return generateDKGId();
}

export function generateAccountId(): DKGId {
    return generateDKGId();
}