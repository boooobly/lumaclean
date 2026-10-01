export function sourceFingerprint(root?:string):string;
export function normalizedSource(path:string,text:string):string;
export function sourceInventory(root?:string):Record<string,string>;
export function verifiedRelease(root?:string):{verified:boolean;count:number};
