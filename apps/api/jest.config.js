/** @type {import('jest').Config} */
module.exports = {
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", {}],
  },
  moduleFileExtensions: ["js", "json", "ts"],
  // @gembala/shared ships ESM-only dist output; point Jest (CJS) at its TS
  // source so ts-jest compiles it in-graph instead of trying to require() ESM.
  moduleNameMapper: {
    "^@gembala/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
    // @gembala/shared's source uses NodeNext-style relative imports with
    // explicit ".js" extensions that resolve to ".ts" files at compile time;
    // strip the extension so Jest's CJS resolver finds the .ts source.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
}
