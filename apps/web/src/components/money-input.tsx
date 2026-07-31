"use client";

// Amount input that shows thousands separators while typing (10,000) and
// submits the raw number through a hidden field. Use for every money field.

import { useState } from "react";

function group(digits: string): string {
  const [int, dec] = digits.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

export function MoneyInput({
  name,
  defaultValue,
  placeholder,
  required,
  disabled,
  className,
  form,
}: {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  form?: string;
}) {
  const initial =
    defaultValue != null && defaultValue !== "" ? group(String(defaultValue).replace(/,/g, "")) : "";
  const [display, setDisplay] = useState(initial);

  const raw = display.replace(/,/g, "");

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        required={required}
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          const firstDot = cleaned.indexOf(".");
          const normalized =
            firstDot >= 0
              ? cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2)
              : cleaned;
          setDisplay(normalized ? group(normalized) : "");
        }}
        className={className ?? "input mono-num"}
      />
      <input type="hidden" name={name} value={raw} form={form} />
    </>
  );
}
