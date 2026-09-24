import { readFileSync } from "fs"
import { join } from "path"
import { DEFAULT_DESIGN_CONFIG, type DesignConfig } from "./design-config.defaults"

// ОФОРМЛЕНИЕ СЛУЖБЫ ВХОДА — ЕЁ СОБСТВЕННЫЙ `DESIGN-CONFIG` (узел Fractera, шаг 280-10).
//
// 🔒 НАСТРОЙКИ ПРИНАДЛЕЖАТ СЛУЖБЕ, ЯДРО ДОТЯГИВАЕТСЯ: редактор «Дизайн» ядра пишет сюда через дверь
// `/api/settings/design` (ключ `SETTINGS_SECRET`), а применяет развёртывание — оформление запекается в
// страницы на сборке. Служба живёт и без ядра: файла нет — действует её собственная тема.
//
// Та же форма и то же поверхностное слияние, что у сайта-стартера (`fractera-root-starter`), без
// проверки схемой: у службы входа нет `zod`, а неверное значение безвредно — построитель CSS пишет
// только то, что узнаёт.
//
// 🛑 Путь — из `DESIGN_CONFIG_PATH` (абсолютный, выдаёт установщик узла): standalone-сервер работает
// из папки своей сборки, и относительный путь писал бы настройки ВНУТРЬ сборки.
const CONFIG_PATH =
  process.env.DESIGN_CONFIG_PATH ?? join(process.cwd(), "DESIGN-CONFIG", "design-config.json")

export function getDesignConfigPath(): string {
  return CONFIG_PATH
}

export function getDesignConfig(): DesignConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<DesignConfig>
    return {
      ...DEFAULT_DESIGN_CONFIG,
      colors: { light: raw.colors?.light ?? {}, dark: raw.colors?.dark ?? {} },
      fonts: raw.fonts ?? {},
      type: raw.type ?? {},
      shape: raw.shape ?? {},
    } as DesignConfig
  } catch {
    return DEFAULT_DESIGN_CONFIG
  }
}
