import {
  Anek_Latin,
  Anek_Telugu,
  Anek_Devanagari,
  Anek_Tamil,
  Anek_Kannada,
  Anek_Malayalam,
  Anek_Bangla,
  Anek_Gujarati,
  Anek_Gurmukhi,
} from 'next/font/google';
import './globals.css';

// One type family across every script on screen, so Telugu and English sit on the same line as equals.
// Script fonts load only when a glyph needs them.
const latin = Anek_Latin({ subsets: ['latin'], variable: '--f-latin', axes: ['wdth'], display: 'swap' });
const te = Anek_Telugu({ subsets: ['telugu'], variable: '--f-te', preload: false, axes: ['wdth'], display: 'swap' });
const deva = Anek_Devanagari({ subsets: ['devanagari'], variable: '--f-deva', preload: false, axes: ['wdth'], display: 'swap' });
const ta = Anek_Tamil({ subsets: ['tamil'], variable: '--f-ta', preload: false, axes: ['wdth'], display: 'swap' });
const kn = Anek_Kannada({ subsets: ['kannada'], variable: '--f-kn', preload: false, axes: ['wdth'], display: 'swap' });
const ml = Anek_Malayalam({ subsets: ['malayalam'], variable: '--f-ml', preload: false, axes: ['wdth'], display: 'swap' });
const bn = Anek_Bangla({ subsets: ['bengali'], variable: '--f-bn', preload: false, axes: ['wdth'], display: 'swap' });
const gu = Anek_Gujarati({ subsets: ['gujarati'], variable: '--f-gu', preload: false, axes: ['wdth'], display: 'swap' });
const pa = Anek_Gurmukhi({ subsets: ['gurmukhi'], variable: '--f-pa', preload: false, axes: ['wdth'], display: 'swap' });

export const metadata = {
  title: 'Dubash: a medical interpreter for every OPD table',
  description:
    'One phone on the consultation table. Dubash interprets between doctor and patient in 10 Indian languages, checks every dose, and confirms the patient understood. Built on Gnani Prisma and Timbre.',
};

export const viewport = { themeColor: '#EDF1E8', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  const vars = [latin, te, deva, ta, kn, ml, bn, gu, pa].map((f) => f.variable).join(' ');
  return (
    <html lang="en" className={vars}>
      <body>{children}</body>
    </html>
  );
}
