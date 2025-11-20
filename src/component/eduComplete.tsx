import React from "react";

export function EduAutocomplete({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
  }) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState(value);
    const [highlight, setHighlight] = React.useState(0);
    const ref = React.useRef<HTMLDivElement>(null);
  
    React.useEffect(() => setQuery(value), [value]);
  
    const filtered = React.useMemo(
      () =>
        options.filter((o) =>
          o.toLowerCase().includes((query || "").toLowerCase())
        ),
      [options, query]
    );
  
    React.useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);
  
    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlight]) {
          onChange(filtered[highlight]);
          setQuery(filtered[highlight]);
          setOpen(false);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
  
    return (
      <div className="relative" ref={ref}>
        <input
          className="w-full border rounded px-2 py-1"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Gõ hoặc chọn tên EDU"
        />
        {open && filtered.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 max-h-60 overflow-auto rounded border bg-white shadow-lg z-50">
            {filtered.map((opt, idx) => (
              <li
                key={opt}
                className={`px-2 py-1 cursor-pointer ${
                  idx === highlight ? "bg-gray-100" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt);
                  setQuery(opt);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(idx)}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  