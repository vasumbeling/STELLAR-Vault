import { submitSignedXDR, pollTransaction } from './payment';
import { signWithCurrentAccount } from './wallet';

/**
 * Sign an unsigned XDR using whichever signer is actually active — the
 * in-memory PIN account secret key, or Freighter — then submit and poll
 * to finality. Returns the transaction hash. Use for simple "one-shot"
 * actions (trustlines, contract calls) that don't need granular status UI.
 */
export async function signAndSubmit(xdr: string, _address?: string): Promise<string> {
  const signedXdr = await signWithCurrentAccount(xdr);
  const hash = await submitSignedXDR(signedXdr);
  await pollTransaction(hash);
  return hash;
}