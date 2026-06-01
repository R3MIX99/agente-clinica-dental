import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Los handlers de webhooks (MercadoPago, n8n) y tipos externos usan `any`
      // de forma legitima. Se mantiene como advertencia para no perder visibilidad.
      "@typescript-eslint/no-explicit-any": "warn",
      // Los hooks de react-compiler avisan sobre incompatibilidades de librerias
      // (React Hook Form, etc.) que no son accionables a corto plazo.
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
