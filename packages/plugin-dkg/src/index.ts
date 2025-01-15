import { Plugin } from "@elizaos/core";

import { dkgInsert } from "./actions/dkgInsert.ts";

// import { factEvaluator } from "./evaluators/fact.ts";
import { graphSearch } from "./providers/graphSearch.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const dkgPlugin: Plugin = {
    name: "dkg",
    description: "Agent bootstrap with basic actions and evaluators",
    actions: [
        // helloWorld,
        dkgInsert,
    ],
    // evaluators: [factEvaluator],
    providers: [graphSearch],
};
