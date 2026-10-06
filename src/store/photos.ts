/**
 * The optional "before" photo for the current reset. Kept in memory only until
 * the reset is saved, then stored with the journal entry on this device.
 */
let before: Blob | null = null;

export function setBeforePhoto(b: Blob | null) {
  before = b;
}

export function takeBeforePhoto(): Blob | null {
  const b = before;
  before = null;
  return b;
}
