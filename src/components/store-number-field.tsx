"use client";
import { useState } from "react";
export function StoreNumberField({
  label,
  name,
  initial = 1,
  min = 1,
  max = 99,
  onAdjust,
}: {
  label: string;
  name: string;
  initial?: number;
  min?: number;
  max?: number;
  onAdjust?: () => void;
}) {
  const [value, setValue] = useState(String(initial));
  function adjust(delta: number) {
    setValue(
      String(Math.min(max, Math.max(min, (Number(value) || min) + delta))),
    );
    onAdjust?.();
  }
  return (
    <label className="store-field">
      {label}
      <span className="store-stepper">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => adjust(-1)}
        >
          −
        </button>
        <input
          aria-label={label}
          name={name}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => adjust(1)}
        >
          +
        </button>
      </span>
    </label>
  );
}
