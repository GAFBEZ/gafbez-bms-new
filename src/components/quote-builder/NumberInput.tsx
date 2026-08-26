"use client";

import { useState } from "react";

interface NumberInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: string;
  placeholder?: string;
  className?: string;
}

function display(value: number): string {
  return value === 0 ? "" : String(value);
}

/**
 * A plain `<input type="number" value={n}>` bound directly to a numeric
 * state forces the box back to "0" on every keystroke while a field is
 * being cleared (empty string parses to 0, which re-renders as "0"
 * before the next digit lands) -- you can never actually get an empty
 * box to type a fresh number into. This tracks the displayed text
 * separately, only re-syncing it from the real value when that value
 * changes for a reason other than this input's own typing (e.g. picking
 * a catalogue product sets a line's rate) -- adjusted during render per
 * React's guidance, not in an effect, so there's no extra render pass.
 */
export default function NumberInput({ id, value, onChange, min, step, placeholder, className }: NumberInputProps) {
  const [text, setText] = useState(display(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setText(display(value));
  }

  return (
    <input
      id={id}
      type="number"
      min={min}
      step={step}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "") {
          setLastValue(0);
          onChange(0);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          setLastValue(parsed);
          onChange(parsed);
        }
      }}
      className={className}
    />
  );
}
