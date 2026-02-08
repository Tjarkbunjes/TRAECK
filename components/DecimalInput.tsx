'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface DecimalInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function DecimalInput({ value, onChange, placeholder, className }: DecimalInputProps) {
  const [text, setText] = useState(value !== null ? String(value) : '');
  const focused = useRef(false);

  // Sync from parent when not focused
  useEffect(() => {
    if (!focused.current) {
      setText(value !== null ? String(value) : '');
    }
  }, [value]);

  function commit(raw: string) {
    if (!raw) {
      onChange(null);
      return;
    }
    const n = parseFloat(raw);
    onChange(isNaN(n) ? null : n);
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        // Only allow digits, one dot, and optional leading minus
        if (v && !/^-?\d*\.?\d*$/.test(v)) return;
        setText(v);
        // Eagerly update parent for valid complete numbers (not ending in dot)
        if (v && !v.endsWith('.') && !v.endsWith('-')) {
          const n = parseFloat(v);
          if (!isNaN(n)) onChange(n);
        } else if (!v) {
          onChange(null);
        }
      }}
      onBlur={() => {
        focused.current = false;
        commit(text);
        // Clean up display
        if (text) {
          const n = parseFloat(text);
          setText(isNaN(n) ? '' : String(n));
        }
      }}
      className={className}
    />
  );
}
