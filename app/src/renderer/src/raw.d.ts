// A file taken in as its text, as Vite gives it for an import ending in ?raw.
declare module '*?raw' {
  const text: string
  export default text
}
