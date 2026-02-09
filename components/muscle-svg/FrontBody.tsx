'use client';

const INACTIVE = '#333333';
const PRIMARY = '#2626FF';
const SECONDARY = 'rgba(38,38,255,0.30)';
const OUTLINE = '#444444';

interface FrontBodyProps {
  highlighted: Set<string>;
  secondary: Set<string>;
}

function fill(id: string, highlighted: Set<string>, secondary: Set<string>): string {
  if (highlighted.has(id)) return PRIMARY;
  if (secondary.has(id)) return SECONDARY;
  return INACTIVE;
}

export function FrontBody({ highlighted, secondary }: FrontBodyProps) {
  const f = (id: string) => fill(id, highlighted, secondary);

  return (
    <g>
      {/* Head */}
      <ellipse cx="100" cy="30" rx="18" ry="22" fill={INACTIVE} stroke={OUTLINE} strokeWidth="0.5" />

      {/* Neck */}
      <path d="M90,52 L110,52 L110,68 L90,68 Z" fill={INACTIVE} />

      {/* Shoulders - front deltoids */}
      <path
        d="M66,72 C54,68 38,72 34,86 C31,96 38,102 48,100 L56,88 Z"
        fill={f('shoulders-front')}
      />
      <path
        d="M134,72 C146,68 162,72 166,86 C169,96 162,102 152,100 L144,88 Z"
        fill={f('shoulders-front')}
      />

      {/* Chest - pectorals */}
      <path
        d="M100,90 L100,140 C96,140 74,142 64,136 C56,132 52,120 58,106 C64,92 92,88 100,90 Z"
        fill={f('chest')}
      />
      <path
        d="M100,90 L100,140 C104,140 126,142 136,136 C144,132 148,120 142,106 C136,92 108,88 100,90 Z"
        fill={f('chest')}
      />

      {/* Biceps */}
      <path
        d="M48,102 C40,106 30,118 28,140 C26,160 30,174 36,176 C42,176 48,168 50,152 C52,134 52,114 48,102 Z"
        fill={f('biceps')}
      />
      <path
        d="M152,102 C160,106 170,118 172,140 C174,160 170,174 164,176 C158,176 152,168 150,152 C148,134 148,114 152,102 Z"
        fill={f('biceps')}
      />

      {/* Forearms - front */}
      <path
        d="M34,180 C28,184 18,208 14,236 C12,252 16,258 22,256 C30,252 40,240 42,222 C44,204 40,190 34,180 Z"
        fill={f('forearms-front')}
      />
      <path
        d="M166,180 C172,184 182,208 186,236 C188,252 184,258 178,256 C170,252 160,240 158,222 C156,204 160,190 166,180 Z"
        fill={f('forearms-front')}
      />

      {/* Abs */}
      <path
        d="M82,144 L118,144 L118,212 L82,212 Z"
        fill={f('abs')}
      />

      {/* Obliques */}
      <path
        d="M60,144 L80,144 L80,214 L66,216 C60,210 56,184 60,144 Z"
        fill={f('obliques')}
      />
      <path
        d="M140,144 L120,144 L120,214 L134,216 C140,210 144,184 140,144 Z"
        fill={f('obliques')}
      />

      {/* Hip / groin connector (inactive) */}
      <path
        d="M68,218 L80,214 L80,224 L90,228 L100,230 L110,228 L120,224 L120,214 L132,218 L126,230 L100,236 L74,230 Z"
        fill={INACTIVE}
      />

      {/* Quads */}
      <path
        d="M66,222 C58,228 50,256 48,284 C46,308 52,318 60,320 C68,322 78,318 84,312 C90,304 90,268 88,246 C86,230 82,222 76,222 Z"
        fill={f('quads')}
      />
      <path
        d="M134,222 C142,228 150,256 152,284 C154,308 148,318 140,320 C132,322 122,318 116,312 C110,304 110,268 112,246 C114,230 118,222 124,222 Z"
        fill={f('quads')}
      />

      {/* Knees (inactive) */}
      <ellipse cx="72" cy="322" rx="12" ry="6" fill={INACTIVE} />
      <ellipse cx="128" cy="322" rx="12" ry="6" fill={INACTIVE} />

      {/* Calves - front */}
      <path
        d="M62,330 C58,336 54,356 54,372 C54,384 58,392 66,394 C74,396 78,390 80,380 C82,366 80,348 78,336 C76,330 70,328 62,330 Z"
        fill={f('calves-front')}
      />
      <path
        d="M138,330 C142,336 146,356 146,372 C146,384 142,392 134,394 C126,396 122,390 120,380 C118,366 120,348 122,336 C124,330 130,328 138,330 Z"
        fill={f('calves-front')}
      />
    </g>
  );
}
