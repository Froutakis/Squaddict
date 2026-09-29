import { useCallback, useRef, useState } from 'react';
import { signImages } from '../../services/serviceMedia';
import { mergeSigned, pathsToSign, type SignedMap } from '../chat/media';

// Signed URLs for private photos: sign what is missing or about to expire,
// and forget one that failed to load so the next call signs it again.
export function useSignedImages() {
  const [signed, setSigned] = useState<SignedMap>({});
  const signedRef = useRef(signed);
  signedRef.current = signed;

  const signPaths = useCallback((paths: string[]) => {
    const missing = pathsToSign(paths, signedRef.current, Date.now());
    if (missing.length === 0) return;

    signImages(missing)
      .then((fresh) => setSigned((prev) => mergeSigned(prev, fresh)))
      .catch(() => {});
  }, []);

  const dropSigned = useCallback((path: string) => {
    setSigned((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  return { signed, signPaths, dropSigned };
}
