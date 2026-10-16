// Inline icons (Lucide shapes, as used on the main site).
import type { SVGProps } from "react";

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

type P = SVGProps<SVGSVGElement> & { size?: number };

export const SearchIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></svg>
);
export const BackIcon = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
);
export const EyeOffIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M10.73 5.08A10.74 10.74 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" />
    <path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
    <path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" />
    <path d="m2 2 20 20" />
  </svg>
);
export const ShareIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 2v13" /><path d="m16 6-4-4-4 4" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /></svg>
);
export const FilterIcon = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 6h18M7 12h10M10 18h4" /></svg>
);
export const XIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.5} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const MenuIcon = ({ size = 22, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.5} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const LibraryIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </svg>
);
export const ReadingIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
);
export const DiscoverIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" /></svg>
);
export const MeIcon = ({ size = 24, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
);
