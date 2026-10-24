// Diagnostics are opt-in during development and never shown in a production build.
export const showDiagnostics = !!import.meta.env?.DEV && import.meta.env?.VITE_ELUVA_DIAGNOSTICS === 'true'
