import React from 'react';
import { Link } from 'react-router-dom';

interface EigenEstateLogoProps {
  /**
   * - 'full': Icon + divider + 'EigenEstate' wordmark
   * - 'icon': Just the stylized aerodynamic 'E' mark
   * - 'lockup': Interactive SVG + text layout
   */
  variant?: 'full' | 'icon' | 'lockup';
  /**
   * Color theme: 'dark' renders dark ink for white/light backgrounds; 'white' renders white ink for dark/black backgrounds
   */
  theme?: 'dark' | 'white';
  className?: string;
  iconClassName?: string;
  showDomain?: boolean;
  to?: string;
}

/**
 * High-precision vector SVG mark of the Eigen Estate aerodynamic 'E' wing
 */
export function EigenEstateIcon({
  className = 'h-6 w-auto',
  fill = 'currentColor',
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 235 160"
      fill={fill}
      className={className}
      aria-label="Eigen Estate Mark"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 7 148 L 9 144 L 13 139 L 13 138 L 24 127 L 25 127 L 29 123 L 43 116 L 53 116 L 56 118 L 58 118 L 64 121 L 66 123 L 73 127 L 88 139 L 92 141 L 95 144 L 115 154 L 118 154 L 119 155 L 124 155 L 125 156 L 176 156 L 177 155 L 180 155 L 181 154 L 187 153 L 195 149 L 201 144 L 202 144 L 212 134 L 212 133 L 215 130 L 215 129 L 218 126 L 220 122 L 225 116 L 110 116 L 109 115 L 101 115 L 100 114 L 95 114 L 94 113 L 86 111 L 84 110 L 80 106 L 80 104 L 84 100 L 87 100 L 88 99 L 152 99 L 153 98 L 157 98 L 158 97 L 164 96 L 170 93 L 172 91 L 176 89 L 179 86 L 180 86 L 188 78 L 188 77 L 193 72 L 193 71 L 201 61 L 96 61 L 95 62 L 88 62 L 87 63 L 84 63 L 83 64 L 77 65 L 74 67 L 72 67 L 62 72 L 60 74 L 53 78 L 49 82 L 48 82 L 32 98 L 32 99 L 26 106 L 23 112 L 21 114 L 20 117 L 18 119 L 16 123 L 16 125 L 13 130 L 13 132 L 11 135 L 11 137 L 9 141 L 9 144 Z M 228 3 L 131 3 L 130 4 L 124 4 L 123 5 L 120 5 L 119 6 L 116 6 L 113 8 L 111 8 L 105 11 L 103 13 L 99 15 L 96 18 L 95 18 L 52 60 L 52 61 L 45 68 L 45 69 L 39 76 L 39 77 L 35 82 L 34 85 L 32 87 L 30 91 L 32 89 L 32 88 L 40 80 L 40 79 L 57 64 L 58 64 L 61 61 L 62 61 L 67 57 L 70 56 L 72 54 L 80 50 L 82 50 L 85 48 L 87 48 L 88 47 L 91 47 L 92 46 L 95 46 L 96 45 L 101 45 L 102 44 L 178 44 L 179 43 L 183 43 L 184 42 L 190 41 L 204 33 L 215 22 L 215 21 L 219 17 L 221 13 L 225 9 Z"
      />
    </svg>
  );
}

/**
 * EigenEstate Official Brand Logo Component
 */
export function EigenEstateLogo({
  variant = 'full',
  theme = 'dark',
  className = '',
  iconClassName = 'h-7 w-auto',
  showDomain = false,
  to,
}: EigenEstateLogoProps) {
  const isWhite = theme === 'white';

  const content = (() => {
    if (variant === 'icon') {
      return (
        <EigenEstateIcon
          className={iconClassName}
          fill={isWhite ? '#FFFFFF' : '#0A0A0A'}
        />
      );
    }

    if (variant === 'full') {
      const src = isWhite
        ? '/brand/eigen-estate-full-white.png'
        : '/brand/eigen-estate-full.png';
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <img
            src={src}
            alt="EigenEstate"
            className={`${iconClassName} object-contain shrink-0`}
          />
          {showDomain && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isWhite
                  ? 'bg-white/10 text-zinc-300 border-white/20'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              eigenestate.com
            </span>
          )}
        </div>
      );
    }

    // Default 'lockup' layout: Vector SVG + exact matching typography
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <EigenEstateIcon
          className={iconClassName}
          fill={isWhite ? '#FFFFFF' : '#0A0A0A'}
        />
        <span
          className={`h-4 w-px ${isWhite ? 'bg-zinc-700' : 'bg-slate-300'}`}
        />
        <div className="flex items-center gap-1.5">
          <span
            className={`text-base font-bold tracking-tight ${
              isWhite ? 'text-white' : 'text-[#0A0A0A]'
            }`}
          >
            EigenEstate
          </span>
          {showDomain && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                isWhite
                  ? 'bg-white/10 text-zinc-300 border-white/20'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              eigenestate.com
            </span>
          )}
        </div>
      </div>
    );
  })();

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center group transition-transform active:scale-[0.99]">
        {content}
      </Link>
    );
  }

  return content;
}

