declare module 'plotly.js-gl3d-dist' {
  const Plotly: {
    newPlot: (root: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>
    react: (root: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>
    purge: (root: HTMLElement) => void
  }
  export default Plotly
}
