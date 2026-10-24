// Verified reporting and help numbers from Notion task R8 Part C (checked 24 Oct 2026, official pages only).
// African Bank's fraud line could not be verified and is deliberately left out. SABRIC is not a victim hotline.
export const HELP_CHECKED = '2026-10-24';

export interface HelpLine {
  id: string;
  name: string;
  number: string;
  /** what it is for: a ui.* key */
  use: string;
  source: string;
}

export const BANK_LINES: HelpLine[] = [
  { id: 'fnb', name: 'FNB', number: '087 575 9444', use: 'help_use_bank', source: 'https://www.fnb.co.za/security-centre/preventing-fraud/notifications.html' },
  { id: 'capitec', name: 'Capitec', number: '0860 10 20 43', use: 'help_use_bank', source: 'https://www.capitecbank.co.za/fraud-centre/report-fraud/' },
  { id: 'absa', name: 'Absa', number: '0860 557 557', use: 'help_use_bank', source: 'https://www.absa.co.za/talk-to-us/' },
  { id: 'standard', name: 'Standard Bank', number: '0800 222 050', use: 'help_use_bank', source: 'https://www.standardbank.co.za/southafrica/personal/products-and-services/security-centre' },
  { id: 'nedbank', name: 'Nedbank', number: '0800 110 929', use: 'help_use_bank', source: 'https://personal.nedbank.co.za/learn/help-centre/useful-information/victim-of-fraud.html' },
  { id: 'tyme', name: 'TymeBank', number: '0860 999 119', use: 'help_use_bank', source: 'https://gotyme.co.za/personal/service/contact-us' },
];

export const HELP_LINES: Record<'saps' | 'sassa' | 'ncr' | 'obs', HelpLine> = {
  saps: { id: 'saps', name: 'SAPS Crime Stop', number: '08600 10111', use: 'help_use_saps', source: 'https://www.saps.gov.za/services/cc_crime_stop.php' },
  sassa: { id: 'sassa', name: 'SASSA', number: '0800 60 10 11', use: 'help_use_sassa', source: 'https://www.gov.za/about-government/government-call-centres-and-help-lines' },
  ncr: { id: 'ncr', name: 'NCR', number: '0860 627 627', use: 'help_use_ncr', source: 'https://www.ncr.org.za/' },
  obs: { id: 'obs', name: 'Ombudsman for Banking Services', number: '0860 800 900', use: 'help_use_obs', source: 'https://obssa.co.za/form/' },
};

export const telHref = (n: string) => `tel:${n.replace(/\s+/g, '')}`;
