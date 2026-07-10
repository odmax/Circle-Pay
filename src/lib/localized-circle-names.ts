const SAVINGS_NAMES: Record<string, string> = {
  ZA: "Stokvel",
  NG: "Ajo / Esusu",
  GH: "Susu",
  KE: "Chama",
  UG: "Chama",
  ZW: "Mukando",
  CM: "Njangi",
  SN: "Tontine",
  CI: "Tontine",
  BJ: "Tontine",
  TG: "Tontine",
  ML: "Tontine",
  BF: "Tontine",
  NE: "Tontine",
  CD: "Likelemba",
  ET: "Iqub",
  SO: "Hagbad / Ayuuto",
  SL: "Osusu",
  LR: "Susu",
  TZ: "Upatu",
  MW: "Chipereganyu",
  ZM: "Chilimba",
  BW: "Motshelo",
  SZ: "Stokvel",
  LS: "Stokvel",
  NA: "Stokvel",
}

const INVESTMENT_NAMES: Record<string, string> = {
  ZA: "Investment Club",
  NG: "Investment Club",
  KE: "Investment Chama",
  default: "Investment Club",
}

const COUNTRY_CIRCLE_TYPES: Record<string, Record<string, string>> = {
  STOKVEL: SAVINGS_NAMES,
  SAVINGS: SAVINGS_NAMES,
  INVESTMENT: INVESTMENT_NAMES,
}

export function getLocalizedCircleType(type: string, countryCode?: string | null): string {
  if (!countryCode) return type.charAt(0) + type.slice(1).toLowerCase()

  const code = countryCode.toUpperCase()
  const typeMap = COUNTRY_CIRCLE_TYPES[type]
  if (typeMap && typeMap[code]) return typeMap[code]
  if (typeMap && typeMap.default) return typeMap.default

  return type.charAt(0) + type.slice(1).toLowerCase()
}

export function getLocalizedTypeLabel(type: string, countryCode?: string | null): string {
  const localized = getLocalizedCircleType(type, countryCode)
  if (localized.includes("/")) return localized
  return localized.charAt(0).toUpperCase() + localized.slice(1)
}
