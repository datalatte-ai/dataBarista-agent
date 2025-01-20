import dotenv from "dotenv";
dotenv.config();
// @ts-ignore
import DKG from "dkg.js";

export const DkgClient = new DKG({
    environment: process.env.OT_ENVIRONMENT,
    endpoint: process.env.OT_NODE_HOSTNAME,
    port: process.env.OT_NODE_PORT,
    blockchain: {
        name: process.env.OT_BLOCKCHAIN_NAME,
        publicKey: process.env.OT_PUBLIC_KEY,
        privateKey: process.env.OT_PRIVATE_KEY,
    },
    maxNumberOfRetries: 300,
    frequency: 2,
    contentType: "all",
    nodeApiVersion: "/v1",
});