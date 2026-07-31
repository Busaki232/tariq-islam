import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

const addProtocol = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const normalizeExternalUrl = (
  value: string
): string | null => {
  const normalized = addProtocol(value);

  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

export const openInAppLink = async (
  value: string
): Promise<boolean> => {
  const url = normalizeExternalUrl(value);

  if (!url) {
    console.error("Invalid external URL:", value);
    return false;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({
        url,
        presentationStyle: "popover",
        toolbarColor: "#15803d",
      });

      return true;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    return true;
  } catch (error) {
    console.error(
      "Unable to open external link:",
      error
    );

    return false;
  }
};
