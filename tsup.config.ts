import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts", "provider/*.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
});
