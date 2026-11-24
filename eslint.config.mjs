import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // useQuery dùng chung giữ lần render hydrate khớp HTML server khi cache trên máy đã được nạp (xem file đó).
    ignores: ["src/shared/query/use-query.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              importNames: ["useQuery", "useSuspenseQuery", "useQueries"],
              message: "Dùng useQuery từ '@/shared/query/use-query' để không lệch hydrate với cache lưu trên máy.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
