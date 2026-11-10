// Languages Prisma v3.0 hears and Timbre speaks. `voice` is the Timbre v2.5 voice tuned for that language;
// `native` is how the patient sees the language name on their half of the screen.
export const LANGUAGES = {
  'te-IN': { name: 'Telugu', native: 'తెలుగు', voice: 'Lavanya', speak: 'మాట్లాడండి', listen: 'వినండి', again: 'మళ్ళీ' },
  'kn-IN': { name: 'Kannada', native: 'ಕನ್ನಡ', voice: 'Saanvi', speak: 'ಮಾತನಾಡಿ', listen: 'ಕೇಳಿ', again: 'ಮತ್ತೆ' },
  'ta-IN': { name: 'Tamil', native: 'தமிழ்', voice: 'Trisha', speak: 'பேசுங்கள்', listen: 'கேளுங்கள்', again: 'மீண்டும்' },
  'hi-IN': { name: 'Hindi', native: 'हिन्दी', voice: 'Chitra', speak: 'बोलिए', listen: 'सुनिए', again: 'फिर से' },
  'bn-IN': { name: 'Bengali', native: 'বাংলা', voice: 'Kirra', speak: 'বলুন', listen: 'শুনুন', again: 'আবার' },
  'ml-IN': { name: 'Malayalam', native: 'മലയാളം', voice: 'Reshma', speak: 'സംസാരിക്കൂ', listen: 'കേൾക്കൂ', again: 'വീണ്ടും' },
  'mr-IN': { name: 'Marathi', native: 'मराठी', voice: 'Ishaan', speak: 'बोला', listen: 'ऐका', again: 'पुन्हा' },
  'gu-IN': { name: 'Gujarati', native: 'ગુજરાતી', voice: 'Falak', speak: 'બોલો', listen: 'સાંભળો', again: 'ફરીથી' },
  'pa-IN': { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', voice: 'Mehuli', speak: 'ਬੋਲੋ', listen: 'ਸੁਣੋ', again: 'ਦੁਬਾਰਾ' },
  'en-IN': { name: 'English', native: 'English', voice: 'Kaveri', speak: 'Speak', listen: 'Listen', again: 'Again' },
};

// Prisma keyterms (max 200): the words a busy OPD says that generic speech models mangle.
export const KEYTERMS = [
  'Paracetamol', 'Dolo 650', 'Crocin', 'Ibuprofen', 'Diclofenac', 'Aceclofenac', 'Tramadol',
  'Metformin', 'Glimepiride', 'Gliclazide', 'Sitagliptin', 'Vildagliptin', 'Dapagliflozin', 'Empagliflozin', 'Insulin', 'Glargine', 'Mixtard',
  'Amlodipine', 'Telmisartan', 'Losartan', 'Olmesartan', 'Ramipril', 'Enalapril', 'Metoprolol', 'Atenolol', 'Bisoprolol', 'Carvedilol', 'Cilnidipine',
  'Hydrochlorothiazide', 'Chlorthalidone', 'Furosemide', 'Lasix', 'Torsemide', 'Spironolactone',
  'Atorvastatin', 'Rosuvastatin', 'Ecosprin', 'Aspirin', 'Clopidogrel', 'Warfarin', 'Apixaban', 'Isosorbide', 'Sorbitrate', 'Nitroglycerin',
  'Pantoprazole', 'Pan 40', 'Pan-D', 'Omeprazole', 'Rabeprazole', 'Ranitidine', 'Domperidone', 'Ondansetron', 'Emeset', 'Digene', 'Sucralfate', 'Loperamide', 'ORS', 'Lactulose', 'Cremaffin',
  'Amoxicillin', 'Augmentin', 'Azithromycin', 'Azee', 'Cefixime', 'Ceftriaxone', 'Ciprofloxacin', 'Ofloxacin', 'Levofloxacin', 'Doxycycline', 'Metronidazole', 'Nitrofurantoin', 'Albendazole', 'Ivermectin',
  'Cetirizine', 'Levocetirizine', 'Montelukast', 'Montair LC', 'Fexofenadine', 'Allegra', 'Chlorpheniramine', 'Benadryl', 'Ascoril',
  'Salbutamol', 'Asthalin', 'Budesonide', 'Formoterol', 'Foracort', 'Deriphyllin', 'Nebulisation', 'Inhaler', 'Rotacap',
  'Levothyroxine', 'Thyronorm', 'Eltroxin', 'Prednisolone', 'Wysolone', 'Dexamethasone', 'Hydrocortisone',
  'Iron', 'Folic acid', 'Calcium', 'Shelcal', 'Vitamin D3', 'Uprise D3', 'Vitamin B12', 'Becosules', 'Neurobion', 'Zinc',
  'Gabapentin', 'Pregabalin', 'Amitriptyline', 'Sertraline', 'Escitalopram', 'Clonazepam', 'Alprazolam', 'Phenytoin', 'Levetiracetam', 'Valproate',
  'Tamsulosin', 'Finasteride', 'Allopurinol', 'Febuxostat', 'Colchicine', 'Methotrexate', 'Hydroxychloroquine',
  'BP', 'sugar', 'HbA1c', 'fasting sugar', 'creatinine', 'kidney test', 'liver test', 'CBC', 'ECG', 'echo', 'X-ray', 'ultrasound', 'CT scan', 'MRI', 'urine test', 'thyroid test', 'TSH', 'lipid profile', 'dialysis',
  'tablet', 'capsule', 'syrup', 'injection', 'drip', 'ointment', 'drops', 'sachet', 'mg', 'ml',
  '1-0-1', '1-1-1', '0-0-1', '1-0-0', 'OD', 'BD', 'TDS', 'SOS', 'before food', 'after food', 'empty stomach',
  'OPD', 'casualty', 'admission', 'discharge', 'follow-up', 'review', 'referral',
];

// Clinical shorthand that reads fine to a doctor and dangerously to everyone else.
// The interpreter must expand these into plain words before translating.
export const SHORTHAND = ['hold', 'BD', 'TDS', 'OD', 'SOS', 'PRN', 'stat', 'NPO', 'nil by mouth', 'taper', 'continue', 'stop', 'alternate days', 'HS'];

// Every number in what the doctor said must reach the patient unchanged.
// Doses (500), patterns (1-0-1), fractions (1/2) and decimals (2.5) are compared as tokens.
// English dose words count as numbers too: "half a tablet twice a day" must reach the patient as 1/2 and 2.
// ponytail: English only; an Indic number word in the translation shows up as a missing digit, so the turn is
// retried or held (the safe direction). Add Hindi dedh/dhai/aadha etc. here if retries get frequent.
// "once" is left out on purpose: "once, after an injection..." is not a dose.
const DOSE_WORDS = { 'one and a half': '1.5', 'two and a half': '2.5', half: '1/2', twice: '2', thrice: '3' };
const DOSE_RE = new RegExp(`\\b(${Object.keys(DOSE_WORDS).join('|')})\\b`, 'gi');

export function numberTokens(text) {
  const s = String(text).replace(DOSE_RE, (w) => ` ${DOSE_WORDS[w.toLowerCase()]} `);
  return (s.match(/\d+(?:[.\/-]\d+)*/g) || []).map((t) => t.replace(/^0+(?=\d)/, ''));
}

export function doseLock(source, translation) {
  const want = numberTokens(source);
  const have = numberTokens(translation);
  const pool = [...have];
  const missing = [];
  for (const n of want) {
    const i = pool.indexOf(n);
    if (i === -1) missing.push(n);
    else pool.splice(i, 1);
  }
  // ponytail: extra numbers in the translation are flagged too, a translator should never invent a dose
  return { ok: missing.length === 0 && pool.length === 0, missing, extra: pool, checked: want };
}

export function langName(code) {
  return LANGUAGES[code]?.name ?? code;
}
