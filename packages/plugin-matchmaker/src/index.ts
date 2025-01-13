import { Plugin } from "@elizaos/core";
import { serendipityAction } from "./actions/serendipity.ts";
import { continueAction } from "./actions/continue.ts";
import { ignoreAction } from "./actions/ignore.ts";
import { noneAction } from "./actions/none.ts";
import { matchIntentionEvaluator } from "./evaluators/matchIntentionEvaluator.ts";
import { matchIntentionProvider } from "./providers/matchIntentionProvider.ts";
import { matchPoolProvider } from "./providers/matchPoolProvider.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const matchmakerPlugin: Plugin = {
    name: "matchmaker",
    description: "Plugin for professional networking and matching functionality",
    actions: [
        serendipityAction,
        continueAction,
        ignoreAction,
        noneAction,
    ],
    evaluators: [matchIntentionEvaluator],
    providers: [matchIntentionProvider, matchPoolProvider],
};
