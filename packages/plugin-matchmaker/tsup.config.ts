import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: true,
    target: "node18",
    external: [
        "dotenv",
        "fs",
        "path",
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "agentkeepalive",
        "stream",
        "crypto",
        "net",
        "tls",
        "events",
        "url",
        "zlib",
        "util",
        "buffer",
        "ws",
        "bufferutil",
        "utf-8-validate",
        "dkg.js",
        "rdf-canonize",
        "jsonld",
        "@elizaos/plugin-dkg",
        "assertion-tools"
    ],
    esbuildOptions: (options) => {
        options.mainFields = ["module", "main"];
        options.platform = "node";
        options.format = "esm";
        options.target = "node18";
        options.bundle = true;
        options.sourcemap = true;
        options.minify = false;
        options.keepNames = true;
        options.logLevel = "info";
    }
});

