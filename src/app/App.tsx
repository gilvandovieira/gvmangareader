import { useState } from 'react';
import { openCbz, type Cbz } from '../cbz/cbz';
import { Reader } from '../reader/Reader';

const ACCEPT = '.cbz,application/vnd.comicbook+zip,application/x-cbz,application/zip';

export function App() {
  const [book, setBook] = useState<{ id: number; cbz: Cbz }>();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  async function open(file: File) {
    setOpening(true);
    setError(undefined);
    try {
      const cbz = await openCbz(file);
      setBook((previous) => ({ id: (previous?.id ?? 0) + 1, cbz }));
    } catch (e) {
      setError(`Could not open ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setOpening(false);
    }
  }

  const openButton = (
    <label
      className={
        'cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 ' +
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky-400 ' +
        (opening ? 'pointer-events-none opacity-60' : '')
      }
    >
      {opening ? 'Opening…' : 'Open CBZ'}
      <input
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={opening}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void open(file);
        }}
      />
    </label>
  );

  return (
    <main className="h-full">
      {book ? (
        <Reader key={book.id} cbz={book.cbz} actions={openButton} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
          <h1 className="text-xl font-semibold">GV Manga Reader</h1>
          <p className="text-sm text-neutral-400">Pick a .cbz file. It is read in your browser and never uploaded.</p>
          {openButton}
        </div>
      )}
      {error && (
        <p
          className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-md bg-red-950 px-4 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  );
}
