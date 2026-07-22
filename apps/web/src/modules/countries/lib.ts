import "server-only";

/** All IANA timezones (grouped selects get long — keep the plain list). */
export function timezoneList(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** USDT plus all ISO 4217 currency codes known to the runtime. */
export function currencyList(): string[] {
  return ["USDT", ...Intl.supportedValuesOf("currency")];
}
