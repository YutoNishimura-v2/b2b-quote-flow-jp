import prisma from "../db.server";

const MAX_EMAIL_LENGTH = 255;

function text(value: unknown, maxLength = MAX_EMAIL_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type ShopSettingsInput = {
  notificationEmail?: unknown;
  quoteEmailNotificationsEnabled?: unknown;
};

export function getShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      notificationEmail: null,
      quoteEmailNotificationsEnabled: false,
    },
    update: {},
  });
}

export async function updateShopSettings(shop: string, input: ShopSettingsInput) {
  const notificationEmail = text(input.notificationEmail);
  const quoteEmailNotificationsEnabled = booleanValue(
    input.quoteEmailNotificationsEnabled,
  );
  const errors: Record<string, string> = {};

  if (quoteEmailNotificationsEnabled && !notificationEmail) {
    errors.notificationEmail = "通知を有効にするにはメールアドレスが必要です。";
  }

  if (notificationEmail && !isValidEmail(notificationEmail)) {
    errors.notificationEmail = "有効なメールアドレスを入力してください。";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      notificationEmail: notificationEmail || null,
      quoteEmailNotificationsEnabled,
    },
    update: {
      notificationEmail: notificationEmail || null,
      quoteEmailNotificationsEnabled,
    },
  });

  return { ok: true as const, settings };
}
