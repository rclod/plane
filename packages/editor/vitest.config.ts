/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  // Mirror the tsconfig `paths`, most specific first, so tests can import
  // modules that use the editor's `@/` aliases.
  resolve: {
    alias: [
      { find: /^@\/plane-editor\//, replacement: src("ce/") },
      { find: /^@\/styles\//, replacement: src("styles/") },
      { find: /^@\//, replacement: src("core/") },
    ],
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
});
