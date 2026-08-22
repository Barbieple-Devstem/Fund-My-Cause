# Localization Contributor Guide

Fund-My-Cause uses [next-intl](https://next-intl.dev) for internationalization. This guide covers everything a contributor needs to add or maintain a translation.

---

## Table of Contents

1. [Supported Languages](#supported-languages)
2. [Repository Structure](#repository-structure)
3. [Translation File Structure](#translation-file-structure)
4. [Adding a New Locale](#adding-a-new-locale)
5. [Translating Strings](#translating-strings)
6. [Pluralization](#pluralization)
7. [RTL (Right-to-Left) Considerations](#rtl-right-to-left-considerations)
8. [Using Translations in Components](#using-translations-in-components)
9. [Testing Your Translation](#testing-your-translation)
10. [Keeping Translations in Sync](#keeping-translations-in-sync)
11. [New Locale Checklist](#new-locale-checklist)

---

## Supported Languages

| Code | Language | RTL | Status |
|------|----------|-----|--------|
| `en` | English | No | Source of truth |
| `es` | Español | No | Maintained |
| `fr` | Français | No | Maintained |
| `de` | Deutsch | No | Maintained |
| `zh` | 中文 | No | Maintained |
| `ar` | العربية | Yes | Maintained |
| `he` | עברית | Yes | Maintained |

To add a new language, follow the steps in [Adding a New Locale](#adding-a-new-locale).

---

## Repository Structure

```
apps/interface/
├── messages/
│   ├── en.json        ← source of truth — always update this first
│   ├── es.json
│   ├── fr.json
│   ├── de.json
│   ├── zh.json
│   ├── ar.json
│   └── he.json
└── src/i18n/
    ├── config.ts      ← locale list, RTL locales, display names
    ├── routing.ts     ← next-intl routing (localePrefix: "as-needed")
    ├── request.ts     ← server-side message loading
    └── navigation.ts  ← typed Link / useRouter / usePathname
```

### Key files explained

**`src/i18n/config.ts`** — the single authoritative list of active locales:

```ts
export const locales = ["en", "es", "fr", "de", "zh", "ar", "he"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const rtlLocales: Locale[] = ["ar", "he"];

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  zh: "中文",
  ar: "العربية",
  he: "עברית",
};
```

Adding a locale here is sufficient — the middleware, layout, and language switcher automatically pick it up.

---

## Translation File Structure

All message files share the same key structure as `en.json`. Keys are namespaced by page or feature:

```json
{
  "nav": { ... },
  "home": { ... },
  "campaigns": { ... },
  "campaignCard": { ... },
  "pledgeModal": { ... },
  "goalSuccess": { ... },
  "cancelCampaign": { ... },
  "campaignDetail": { ... },
  "countdown": { ... },
  "bookmarks": { ... },
  "compare": { ... },
  "notFound": { ... },
  "common": { ... }
}
```

**Rules:**
- Never remove a key from a translation file — the app will throw at runtime if a key is missing.
- Never rename a key — create a new key and deprecate the old one in a PR comment if renaming is needed.
- All values must be strings. Objects are namespaces, not values.
- When you add a new key to `en.json`, add it to every other locale file as well (use `[TODO: translate]` if you don't speak the language).

---

## Adding a New Locale

Follow these steps to add, for example, Portuguese (`pt`):

### Step 1 — Register the locale

Edit `apps/interface/src/i18n/config.ts`:

```ts
export const locales = ["en", "es", "fr", "de", "zh", "ar", "he", "pt"] as const;

export const localeNames: Record<Locale, string> = {
  // ...existing entries...
  pt: "Português",
};
```

If the language is RTL, also add it to `rtlLocales`:

```ts
export const rtlLocales: Locale[] = ["ar", "he"]; // add "ur", "fa", etc. here if needed
```

### Step 2 — Create the translation file

Copy the English source file and translate every value:

```bash
cp apps/interface/messages/en.json apps/interface/messages/pt.json
```

Then open `pt.json` and translate each string value. Leave key names unchanged.

### Step 3 — Verify

The middleware, layout, and language switcher pick up the new locale automatically — no other code changes are required. Verify with:

```bash
cd apps/interface
npm run dev
# Navigate to http://localhost:3000/pt
```

---

## Translating Strings

### Plain strings

```json
"connectWallet": "Connect Wallet"
```

Translate the value only. The key must stay exactly the same.

### Strings with interpolated variables

Variables use `{variableName}` syntax:

```json
"raised": "{amount} XLM raised"
```

Keep the `{variableName}` placeholders exactly as they are — only translate the surrounding text.

```json
// Spanish
"raised": "{amount} XLM recaudado"

// Arabic (note: keep {amount} in place even in RTL text)
"raised": "{amount} XLM تم جمعه"
```

### HTML in strings (rare)

Some strings contain inline HTML. Preserve the tags:

```json
"irreversibleWarning": "This action is <strong>irreversible</strong>. All contributors will be able to claim a full refund."
```

```json
// French
"irreversibleWarning": "Cette action est <strong>irréversible</strong>. Tous les contributeurs pourront réclamer un remboursement complet."
```

---

## Pluralization

Fund-My-Cause uses ICU message format for plurals. The general form is:

```
{count, plural, =0 {zero case} one {singular} other {plural}}
```

**Examples from `en.json`:**

```json
"found": "{count} campaign found",
"foundPlural": "{count} campaigns found"
```

For languages with more complex plural rules, use ICU plural categories:

| Category | Meaning |
|----------|---------|
| `zero` | Exactly 0 (used in some languages, e.g. Arabic) |
| `one` | Singular (language-specific rule) |
| `two` | Dual (used in Arabic, Hebrew) |
| `few` | Small plural (used in Slavic languages) |
| `many` | Large plural |
| `other` | Default/fallback plural |

**English (simple):**

```json
"deadlineAlert": "{title} ends in {days, plural, =0 {less than a day} one {# day} other {# days}}!"
```

**Arabic (dual + plural categories):**

```json
"deadlineAlert": "{title} تنتهي خلال {days, plural, =0 {أقل من يوم} one {يوم واحد} two {يومين} few {# أيام} many {# يومًا} other {# يوم}}!"
```

**Hebrew (dual form):**

```json
"deadlineAlert": "{title} מסתיים בעוד {days, plural, =0 {פחות מיום} one {יום אחד} two {יומיים} other {# ימים}}!"
```

When in doubt, use at least `one` and `other` — next-intl will fall back gracefully.

---

## RTL (Right-to-Left) Considerations

Arabic (`ar`) and Hebrew (`he`) are RTL languages. The app handles most RTL layout automatically, but contributors should be aware of the following.

### Automatic RTL handling

The layout adds `dir="rtl"` to the `<html>` element for RTL locales via the locale-specific layout file. This affects:

- Text alignment (right-aligned by default)
- Flex direction (reversed in RTL)
- Scroll direction

No action is required from translators for this to work.

### Translating into RTL languages

1. Write the translated text naturally in the RTL language. Do not manually insert direction markers (`‫`, `‬`, `\u200f`) — the browser applies directionality based on the HTML `dir` attribute.
2. Preserve `{variable}` placeholders in the correct position for the translated sentence. In RTL, the placeholder position may shift:

```json
// English
"raised": "{amount} XLM raised"

// Arabic — amount appears on the right in RTL context, so position it at the start of the string
"raised": "{amount} XLM تم جمعها"
```

3. Numbers and amounts (`{amount}`, `{count}`) render as-is. The browser handles number directionality via the Bidirectional Algorithm — you do not need to do anything special.

### Writing new UI components for RTL

If you are a developer writing a new component (not just translating), follow these guidelines:

- Use **logical CSS properties** instead of physical ones:
  - `margin-inline-start` / `margin-inline-end` instead of `margin-left` / `margin-right`
  - `padding-inline-start` / `padding-inline-end` instead of `padding-left` / `padding-right`
- Use **Tailwind logical utilities**:
  - `ps-4` / `pe-4` (padding-inline-start / end) instead of `pl-4` / `pr-4`
  - `ms-4` / `me-4` (margin-inline-start / end) instead of `ml-4` / `mr-4`
  - `start-0` / `end-0` instead of `left-0` / `right-0`
- Avoid hardcoded `text-left` / `text-right` — use `text-start` / `text-end` instead.
- Icons that imply direction (arrows, chevrons) may need to be mirrored in RTL. Use `rtl:scale-x-[-1]` in Tailwind to flip them.

**Example — RTL-aware component:**

```tsx
// ✅ Correct — works in both LTR and RTL
<div className="flex items-center gap-2 ps-4">
  <ChevronRightIcon className="rtl:scale-x-[-1]" />
  <span>{label}</span>
</div>

// ❌ Avoid — breaks in RTL
<div className="flex items-center gap-2 pl-4">
  <ChevronRightIcon />
  <span>{label}</span>
</div>
```

---

## Using Translations in Components

### Server components (no `"use client"`)

```tsx
import { useTranslations } from "next-intl";

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  return <h1>{t("title")}</h1>;
}
```

### Client components (`"use client"`)

```tsx
"use client";
import { useTranslations } from "next-intl";

export function PledgeButton() {
  const t = useTranslations("pledgeModal");
  return <button>{t("confirmPledge")}</button>;
}
```

### Strings with variables

```tsx
const t = useTranslations("home");
// en.json: "raised": "{amount} XLM raised"
return <span>{t("raised", { amount: "1,000" })}</span>;
```

### Plural strings

```tsx
const t = useTranslations("campaigns");
// en.json: "found": "{count} campaign found"
//          "foundPlural": "{count} campaigns found"
return <span>{count === 1 ? t("found", { count }) : t("foundPlural", { count })}</span>;
```

Or with ICU plurals in a single key:

```tsx
const t = useTranslations("bookmarks");
// en.json: "deadlineAlert": "... {days, plural, ...}"
return <span>{t("deadlineAlert", { title, days })}</span>;
```

### Navigation (locale-aware links)

Use the typed navigation helpers from `src/i18n/navigation.ts` instead of Next.js's built-in `Link`:

```tsx
import { Link } from "@/i18n/navigation";

// Automatically prefixes with the current locale
<Link href="/campaigns">Browse</Link>
```

---

## Testing Your Translation

### Run the dev server

```bash
cd apps/interface
npm run dev
```

### Browse each locale

| URL | Language |
|-----|---------|
| `http://localhost:3000/` | English (default, no prefix) |
| `http://localhost:3000/es` | Español |
| `http://localhost:3000/fr` | Français |
| `http://localhost:3000/de` | Deutsch |
| `http://localhost:3000/zh` | 中文 |
| `http://localhost:3000/ar` | العربية (RTL) |
| `http://localhost:3000/he` | עברית (RTL) |

### What to check

- All visible text is translated (no English strings showing in a non-English locale)
- Interpolated values (`{amount}`, `{count}`, etc.) render correctly
- Plural forms work for 0, 1, and N > 1
- RTL layout looks correct in `ar` and `he` — text flows right-to-left, icons are mirrored
- The language switcher in the navbar shows your new locale and switches to it correctly
- No console errors about missing translation keys

### Check for missing keys

Run this script from the repo root to find any keys present in `en.json` but missing from other locales:

```bash
node -e "
const en = require('./apps/interface/messages/en.json');
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? flat(v, prefix + k + '.') : [prefix + k]
  );
const enKeys = flat(en);
['es', 'fr', 'de', 'zh', 'ar', 'he'].forEach(lang => {
  let other;
  try { other = require('./apps/interface/messages/' + lang + '.json'); }
  catch { console.log(lang + ': file not found'); return; }
  const missing = enKeys.filter(k => {
    const parts = k.split('.');
    let o = other;
    for (const p of parts) { o = o?.[p]; }
    return o === undefined;
  });
  if (missing.length) console.log(lang + ' missing:', missing);
  else console.log(lang + ': OK');
});
"
```

---

## Keeping Translations in Sync

When adding new UI text:

1. Add the key and English value to `messages/en.json` first.
2. Add the same key to all other locale files with a translated value, or use `[TODO: translate]` as a placeholder if you don't speak the language.
3. Open a PR — the missing-key check (above) should show no output for maintained locales.

### Placeholder convention

If a translation is not yet available, use `[TODO: translate]` as the value:

```json
// In pt.json (Portuguese, not yet fully translated)
"pledgeNow": "[TODO: translate]"
```

This makes untranslated strings visible at runtime rather than silently showing an empty string or crashing.

---

## New Locale Checklist

Copy this checklist into your pull request description:

```
## Locale: [code] — [Language name]

### Setup
- [ ] Locale code added to `locales` array in `src/i18n/config.ts`
- [ ] Display name added to `localeNames` in `src/i18n/config.ts`
- [ ] If RTL: locale code added to `rtlLocales` in `src/i18n/config.ts`
- [ ] Translation file created at `messages/[code].json`

### Translation
- [ ] All keys from `messages/en.json` are present in `messages/[code].json`
- [ ] No keys have empty string values (use `[TODO: translate]` as placeholder)
- [ ] `{variable}` placeholders preserved exactly as in the English source
- [ ] Plural forms cover at least `one` and `other` (more if the language requires)
- [ ] HTML tags preserved in strings that contain them

### RTL (if applicable)
- [ ] Locale added to `rtlLocales` in `config.ts`
- [ ] Manually verified RTL layout at `http://localhost:3000/[code]`
- [ ] Directional icons appear mirrored in RTL

### Testing
- [ ] `npm run dev` starts without errors
- [ ] All pages visible at `http://localhost:3000/[code]` with no English leakage
- [ ] Language switcher shows the new locale and switches to it
- [ ] Missing-key script shows no missing keys for the new locale
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
```

---

## Related Docs

- [i18n configuration source](../apps/interface/src/i18n/config.ts)
- [next-intl documentation](https://next-intl.dev)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [Tailwind CSS logical properties](https://tailwindcss.com/docs/padding#using-logical-properties)
- [MDN: CSS Logical Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
- [Unicode Bidirectional Algorithm](https://unicode.org/reports/tr9/)
