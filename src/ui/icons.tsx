import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (d: React.ReactNode) =>
  function Icon(p: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
        {d}
      </svg>
    );
  };

export const IconHome = base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>);
export const IconGrid = base(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>);
export const IconTag = base(<><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="8" cy="8" r="1.6" /></>);
export const IconFolder = base(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>);
export const IconSettings = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconPlus = base(<><path d="M12 5v14M5 12h14" /></>);
export const IconSearch = base(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconX = base(<><path d="M18 6 6 18M6 6l12 12" /></>);
export const IconCheck = base(<><path d="M20 6 9 17l-5-5" /></>);
export const IconTrash = base(<><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /><path d="M10 11v6M14 11v6" /></>);
export const IconUpload = base(<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>);
export const IconDownload = base(<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>);
export const IconShare = base(<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>);
export const IconCopy = base(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>);
export const IconImage = base(<><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>);
export const IconBack = base(<><path d="M15 18 9 12l6-6" /></>);
export const IconUp = base(<><path d="m18 15-6-6-6 6" /></>);
export const IconDown = base(<><path d="m6 9 6 6 6-6" /></>);
export const IconEdit = base(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></>);
export const IconRefresh = base(<><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>);
export const IconInfo = base(<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>);
export const IconAlert = base(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>);
export const IconText = base(<><path d="M4 7V4h16v3M9 20h6M12 4v16" /></>);
export const IconSpark = base(<><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" /></>);
export const IconLoader = base(<><path d="M21 12a9 9 0 1 1-9-9" /></>);
export const IconOffline = base(<><path d="M2 2l20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2-1.5M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 11 5.1" /><path d="M12 20h.01" /></>);
export const IconSelect = base(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></>);
export const IconSort = base(<><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></>);
export const IconFilter = base(<><path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" /></>);
export const IconClipboard = base(<><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /></>);
export const IconPhone = base(<><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>);
export const IconShield = base(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /></>);
export const IconLink = base(<><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>);
export const IconMail = base(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></>);
export const IconCalendar = base(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></>);
export const IconScan = base(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>);
export const IconUndo = base(<><path d="M4 10h10a5.5 5.5 0 0 1 0 11h-3" /><path d="m8 6-4 4 4 4" /></>);
export const IconTextCopy = base(<><rect x="8" y="3" width="12" height="12" rx="2" /><path d="M16 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" /></>);
export const IconOpen = base(<><path d="M14 5h5v5" /><path d="M19 5 11 13" /><path d="M19 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>);
