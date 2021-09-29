import pluginTypescript from "@rollup/plugin-typescript";
import pluginCommonjs from "@rollup/plugin-commonjs";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";
import * as path from "path";
import pkg from "./package.json";

const moduleName = pkg.name.replace(/^@.*\//, "");
const inputFileName = "src/index.ts";
const banner = `// ${moduleName} - version ${pkg.version}`;

export default [
    {
        input: inputFileName,
        output: [
            {
                file: pkg.main,
                format: "cjs",
                sourcemap: true,
                banner,
                exports: "named",
            },
        ],
        external: [
            ...Object.keys(pkg.peerDependencies || {}),
        ],
        plugins: [
            pluginTypescript({
                target: "ES2019",
                include: [ "src/**/*.ts" ],
            }),
            pluginCommonjs({
                extensions: [".js", ".ts"],
            }),
            babel({
                babelHelpers: "bundled",
                configFile: path.resolve(__dirname, ".babelrc"),
            }),
            pluginNodeResolve({
                browser: false,
            }),
        ],
    },
];
