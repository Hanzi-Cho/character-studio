export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    send: (
      <>
        <path d="m6 10 6-6 6 6M12 4v16" />
      </>
    ),
    undo: (
      <>
        <path d="M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7" />
      </>
    ),
    redo: (
      <>
        <path d="m16 5 5 5-5 5M21 10H11a7 7 0 0 0-7 7" />
      </>
    ),
    front: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="5" />
        <path d="M9 10v1m6-1v1m-6 4q3 2 6 0" />
      </>
    ),
    save: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
      </>
    ),
    camera: (
      <>
        <path d="M8 6 9 3h6l1 3h4v14H4V6z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 1 1 4 2.8c-1 .4-1 1.2-1 2.2M12 17h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    sparkle: (
      <>
        <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z" />
      </>
    ),
    history: (
      <>
        <path d="M3 4v5h5M3 9a9 9 0 1 1 1 8M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.sparkle}
    </svg>
  );
}
