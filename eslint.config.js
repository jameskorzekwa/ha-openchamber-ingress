export default [
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        process: "readonly",
        Set: "readonly",
        URL: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-var": "error",
      "prefer-const": "error"
    }
  },
  {
    files: ["openchamber_ingress/rootfs/www/*.js"],
    rules: {
      "no-var": "off",
      "prefer-const": "off"
    }
  },
  {
    ignores: ["node_modules/**", "coverage/**"]
  }
];
