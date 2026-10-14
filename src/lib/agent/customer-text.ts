/** Fold Latin accents for Serbian aliases while preserving Cyrillic й/ё. */
export function normalizeCustomerText(text:string){
 return text.normalize('NFD').replace(/([A-Za-z])\p{M}+/gu,'$1').normalize('NFC').toLowerCase();
}
