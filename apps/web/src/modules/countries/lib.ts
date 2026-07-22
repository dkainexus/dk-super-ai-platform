import "server-only";

/** All IANA timezones (grouped selects get long — keep the plain list). */
export function timezoneList(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** All ISO 4217 currency codes known to the runtime. */
export function currencyList(): string[] {
  return Intl.supportedValuesOf("currency");
}
