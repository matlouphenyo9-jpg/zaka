// Feature switches. Anything not solid at the freeze is turned off here, and the rest of the app keeps working.
export const FLAGS = {
  /** "📸 Snap or upload a slip" on Home and Add, and the /scan screen. */
  slipScan: true,
  /** Accept PDFs (emailed slips, proof of payment, payslips) as well as photos and screenshots. */
  slipPdf: true,
} as const;
