'use client';

const INACTIVE = '#333333';
const PRIMARY = '#2626FF';
const SECONDARY = 'rgba(38,38,255,0.30)';
const OUTLINE = '#444444';

interface BackBodyProps {
  highlighted: Set<string>;
  secondary: Set<string>;
}

function fill(id: string, highlighted: Set<string>, secondary: Set<string>): string {
  if (highlighted.has(id)) return PRIMARY;
  if (secondary.has(id)) return SECONDARY;
  return INACTIVE;
}

export function BackBody({ highlighted, secondary }: BackBodyProps) {
  const f = (id: string) => fill(id, highlighted, secondary);

  return (
    <g>
      {/* Head */}
      <ellipse cx="100" cy="30" rx="18" ry="22" fill={INACTIVE} stroke={OUTLINE} strokeWidth="0.5" />

      {/* Neck */}
      <path d="M90,52 L110,52 L110,68 L90,68 Z" fill={INACTIVE} />

      {/* Traps */}
      <path
        d="M90,68 C82,70 68,74 62,84 C58,92 66,100 74,102 L90,96 Z"
        fill={f('traps')}
      />
      <path
        d="M110,68 C118,70 132,74 138,84 C142,92 134,100 126,102 L110,96 Z"
        fill={f('traps')}
      />

      {/* Rear delts */}
      <path
        d="M60,82 C48,78 36,82 34,94 C32,104 40,108 48,106 L56,96 Z"
        fill={f('rear-delts')}
      />
      <path
        d="M140,82 C152,78 164,82 166,94 C168,104 160,108 152,106 L144,96 Z"
        fill={f('rear-delts')}
      />

      {/* Back upper - center spine area */}
      <path
        d="M88,98 L112,98 L112,164 L88,164 Z"
        fill={f('back-upper')}
      />
      {/* Back upper - left lat */}
      <path
        d="M88,98 L74,104 C64,110 56,128 54,148 C53,160 58,166 66,166 L88,164 Z"
        fill={f('back-upper')}
      />
      {/* Back upper - right lat */}
      <path
        d="M112,98 L126,104 C136,110 144,128 146,148 C147,160 142,166 134,166 L112,164 Z"
        fill={f('back-upper')}
      />

      {/* Back lower */}
      <path
        d="M68,168 L132,168 L136,218 L64,218 Z"
        fill={f('back-lower')}
      />

      {/* Triceps */}
      <path
        d="M46,108 C38,112 28,128 26,150 C24,168 28,178 36,180 C42,180 48,172 50,156 C52,138 50,118 46,108 Z"
        fill={f('triceps')}
      />
      <path
        d="M154,108 C162,112 172,128 174,150 C176,168 172,178 164,180 C158,180 152,172 150,156 C148,138 150,118 154,108 Z"
        fill={f('triceps')}
      />

      {/* Forearms - back */}
      <path
        d="M34,184 C28,188 18,212 14,240 C12,256 16,262 22,260 C30,256 40,244 42,226 C44,208 40,194 34,184 Z"
        fill={f('forearms-back')}
      />
      <path
        d="M166,184 C172,188 182,212 186,240 C188,256 184,262 178,260 C170,256 160,244 158,226 C156,208 160,194 166,184 Z"
        fill={f('forearms-back')}
      />

      {/* Glutes */}
      <path
        d="M68,222 C58,226 54,244 56,260 C58,274 68,278 80,278 L98,278 L98,222 Z"
        fill={f('glutes')}
      />
      <path
        d="M132,222 C142,226 146,244 144,260 C142,274 132,278 120,278 L102,278 L102,222 Z"
        fill={f('glutes')}
      />

      {/* Hamstrings */}
      <path
        d="M64,282 C56,288 50,308 50,328 C50,334 56,336 64,336 C72,336 82,332 86,324 C90,316 90,296 88,282 Z"
        fill={f('hamstrings')}
      />
      <path
        d="M136,282 C144,288 150,308 150,328 C150,334 144,336 136,336 C128,336 118,332 114,324 C110,316 110,296 112,282 Z"
        fill={f('hamstrings')}
      />

      {/* Calves - back */}
      <path
        d="M62,340 C56,346 52,364 54,380 C56,392 62,398 70,398 C78,398 82,392 84,380 C86,364 82,348 76,340 Z"
        fill={f('calves-back')}
      />
      <path
        d="M138,340 C144,346 148,364 146,380 C144,392 138,398 130,398 C122,398 118,392 116,380 C114,364 118,348 124,340 Z"
        fill={f('calves-back')}
      />
    </g>
  );
}
