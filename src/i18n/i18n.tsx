import { createContext, useContext, useMemo, type ReactNode } from "react";
import { en } from "./en";
import { ru } from "./ru";

export type Language = "ru" | "en";
/** Simple mode hides Git concepts and uses plain words; full mode is a regular Git client. */
export type UiMode = "simple" | "full";

/** A message, or plural forms chosen by the `count` parameter. */
export type Plural = {
  one: string;
  few?: string;
  many?: string;
  other: string;
};
export type Message = string | Plural;

/** Keys callers use. A dictionary may also hold "<key>@simple" with simple-mode wording. */
export type Key = Exclude<keyof typeof en, `${string}@simple`>;
export type Params = Record<string, string | number>;

const dictionaries: Record<Language, Record<string, Message>> = { en, ru };

export function translate(
  language: Language,
  mode: UiMode,
  key: Key,
  params: Params = {},
): string {
  const dictionary = dictionaries[language];
  const message =
    (mode === "simple" ? dictionary[`${key}@simple`] : undefined) ??
    dictionary[key] ??
    en[key];
  const text =
    typeof message === "string"
      ? message
      : pluralForm(language, message, Number(params.count ?? 0));
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

function pluralForm(language: Language, plural: Plural, count: number) {
  const form = new Intl.PluralRules(language).select(count);
  return (
    (form === "one"
      ? plural.one
      : form === "few"
        ? plural.few
        : form === "many"
          ? plural.many
          : undefined) ?? plural.other
  );
}

export function timeAgo(language: Language, date: number, now = Date.now()) {
  const relative = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const minutes = Math.round((date - now) / 60_000);
  if (minutes > -1) return translate(language, "full", "time.justNow");
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

type I18n = {
  language: Language;
  mode: UiMode;
  t: (key: Key, params?: Params) => string;
  timeAgo: (date: number) => string;
};

const I18nContext = createContext<I18n>({
  language: "en",
  mode: "full",
  t: (key, params) => translate("en", "full", key, params),
  timeAgo: (date) => timeAgo("en", date),
});

export function I18nProvider({
  language,
  mode,
  children,
}: {
  language: Language;
  mode: UiMode;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(
    () => ({
      language,
      mode,
      t: (key, params) => translate(language, mode, key, params),
      timeAgo: (date) => timeAgo(language, date),
    }),
    [language, mode],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
