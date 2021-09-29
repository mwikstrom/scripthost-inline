const config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testRegex: "test/.*\\.spec\\.tsx?$",
    collectCoverage: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: ["src/**/*.ts"],
};

module.exports = config;
