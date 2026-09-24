// Адрес пункта меню: абсолютный — как есть (у служб все адреса ведут на сайт), относительный — с языком.
// ✗ оплачено 280-3: дописанный к абсолютному адресу язык дал `/ru/ru/site` и 404.
export function shellHref(lang: string, href: string | undefined, fallbackPath: string): string {
  if (href && /^https?:\/\//.test(href)) return href
  return href ? `/${lang}${href}` : fallbackPath
}

/** Ссылка на корень проекта у элемента `<a>`/`Link`: абсолютный адрес или путь сайта. */
export const isAbsolute = (href: string) => /^https?:\/\//.test(href)
