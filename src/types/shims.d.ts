declare module 'crypto-js' {
  const CryptoJS: any
  export default CryptoJS
}

declare module 'pako' {
  export function inflate(data: Uint8Array | number[]): Uint8Array
  export function deflate(data: Uint8Array | number[] | string): Uint8Array
}
