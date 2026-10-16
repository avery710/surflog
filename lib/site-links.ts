/** Address behind the footer's mail link. Not translated. */
export const SUPPORT_EMAIL = "support@surflog.tw";

export type SocialLink = {
  key: "mail";
  href: string;
  /** i18n key of the aria-label; `{email}` is filled for mail. */
  labelKey: "footer.emailLabel";
};

/**
 * The footer's circle icons, in order. To add a network (e.g. Instagram, no
 * account yet): add a label key in lib/i18n.tsx, an icon (an inline Simple
 * Icons SVG, lucide 1.x has no brand glyphs), one entry here, and a case in
 * the footer's icon map.
 */
export const SOCIAL_LINKS: SocialLink[] = [
  { key: "mail", href: `mailto:${SUPPORT_EMAIL}`, labelKey: "footer.emailLabel" },
];
