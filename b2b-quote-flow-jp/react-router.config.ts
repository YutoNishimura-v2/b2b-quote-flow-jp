import type { Config } from "@react-router/dev/config";

export default {
  allowedActionOrigins: [
    "admin.shopify.com",
    "*.myshopify.com",
    "**.app.github.dev",
  ],
} satisfies Config;
