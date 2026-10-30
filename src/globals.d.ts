/** The version from package.json, filled in by Vite. */
declare const __APP_VERSION__: string;

/** A file's text, through Vite's `?raw` import. */
declare module "*?raw" {
  const text: string;
  export default text;
}
