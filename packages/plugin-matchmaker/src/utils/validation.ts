import { elizaLogger } from "@elizaos/core";

export function checkFields(obj: any, fields: readonly string[]): boolean {
    const results = fields.map(field => {
        const value = obj[field];
        const confidence = obj.confidence[field] || 0;
        const isValid = value && confidence > 0.7;

        // Log each field check
        elizaLogger.debug(`Field Check: ${field}`, {
            value,
            confidence,
            isValid
        });

        return isValid;
    });
    return results.every(result => result === true);
}