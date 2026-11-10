// Fixed strings in the patient's language: labels for the patient's own buttons, the one sentence Dubash says when
// a question cannot be answered from the slip, and the doctor's quick phrases.
// Quick phrases never touch the interpreter model: the text is fixed, so there is nothing to mistranslate at run time.
// All of these are awaiting review by native speakers, like the demo script.

export const QUICK = [
  { id: 'since', en: 'Since when have you had this?' },
  { id: 'where', en: 'Where does it hurt?' },
  { id: 'fever', en: 'Do you have a fever?' },
  { id: 'allergy', en: 'Are you allergic to any medicine?' },
  { id: 'meds', en: 'Which medicines are you taking now?' },
  { id: 'again', en: 'Please say that again, slowly.' },
];

export const PHRASES = {
  'te-IN': {
    lost: 'అర్థం కాలేదు',
    family: 'కుటుంబ సభ్యులు',
    askDoctor: 'ఇది స్లిప్‌లో లేదు. దయచేసి మీ డాక్టర్‌ని అడగండి.',
    quick: {
      since: 'ఎప్పటి నుంచి ఉంది?',
      where: 'ఎక్కడ నొప్పిగా ఉంది?',
      fever: 'జ్వరం ఉందా?',
      allergy: 'మీకు ఏదైనా మందు పడదా?',
      meds: 'ఇప్పుడు ఏ మందులు వేసుకుంటున్నారు?',
      again: 'దయచేసి మళ్ళీ నెమ్మదిగా చెప్పండి.',
    },
  },
  'kn-IN': {
    lost: 'ಅರ್ಥವಾಗಲಿಲ್ಲ',
    family: 'ಕುಟುಂಬದವರು',
    askDoctor: 'ಇದು ಚೀಟಿಯಲ್ಲಿ ಇಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಡಾಕ್ಟರನ್ನು ಕೇಳಿ.',
    quick: {
      since: 'ಯಾವಾಗಿನಿಂದ ಇದೆ?',
      where: 'ಎಲ್ಲಿ ನೋವಿದೆ?',
      fever: 'ಜ್ವರ ಇದೆಯಾ?',
      allergy: 'ನಿಮಗೆ ಯಾವುದಾದರೂ ಔಷಧಿ ಆಗುವುದಿಲ್ಲವೇ?',
      meds: 'ಈಗ ಯಾವ ಔಷಧಿಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೀರಿ?',
      again: 'ದಯವಿಟ್ಟು ನಿಧಾನವಾಗಿ ಮತ್ತೆ ಹೇಳಿ.',
    },
  },
  'ta-IN': {
    lost: 'புரியவில்லை',
    family: 'குடும்பத்தினர்',
    askDoctor: 'இது சீட்டில் இல்லை. தயவுசெய்து உங்கள் டாக்டரிடம் கேளுங்கள்.',
    quick: {
      since: 'எப்போதிலிருந்து இருக்கிறது?',
      where: 'எங்கே வலிக்கிறது?',
      fever: 'காய்ச்சல் இருக்கிறதா?',
      allergy: 'ஏதாவது மருந்து உங்களுக்கு ஒத்துக்கொள்ளாதா?',
      meds: 'இப்போது என்ன மருந்துகள் சாப்பிடுகிறீர்கள்?',
      again: 'தயவுசெய்து மெதுவாக மறுபடியும் சொல்லுங்கள்.',
    },
  },
  'hi-IN': {
    lost: 'समझ नहीं आया',
    family: 'परिवार',
    askDoctor: 'यह पर्ची में नहीं है। कृपया अपने डॉक्टर से पूछिए।',
    quick: {
      since: 'यह कब से है?',
      where: 'दर्द कहाँ है?',
      fever: 'बुखार है क्या?',
      allergy: 'क्या आपको किसी दवा से एलर्जी है?',
      meds: 'अभी कौन सी दवाइयाँ ले रहे हैं?',
      again: 'कृपया धीरे से फिर बताइए।',
    },
  },
  'bn-IN': {
    lost: 'বুঝিনি',
    family: 'পরিবার',
    askDoctor: 'এটা স্লিপে নেই। দয়া করে আপনার ডাক্তারকে জিজ্ঞাসা করুন।',
    quick: {
      since: 'কবে থেকে হচ্ছে?',
      where: 'কোথায় ব্যথা করছে?',
      fever: 'জ্বর আছে কি?',
      allergy: 'কোনো ওষুধে আপনার অ্যালার্জি আছে কি?',
      meds: 'এখন কী কী ওষুধ খাচ্ছেন?',
      again: 'দয়া করে আস্তে আস্তে আবার বলুন।',
    },
  },
  'ml-IN': {
    lost: 'മനസ്സിലായില്ല',
    family: 'കുടുംബാംഗം',
    askDoctor: 'ഇത് സ്ലിപ്പിൽ ഇല്ല. ദയവായി നിങ്ങളുടെ ഡോക്ടറോട് ചോദിക്കൂ.',
    quick: {
      since: 'എപ്പോൾ മുതലാണ്?',
      where: 'എവിടെയാണ് വേദന?',
      fever: 'പനി ഉണ്ടോ?',
      allergy: 'ഏതെങ്കിലും മരുന്നിന് അലർജി ഉണ്ടോ?',
      meds: 'ഇപ്പോൾ ഏതൊക്കെ മരുന്നുകൾ കഴിക്കുന്നുണ്ട്?',
      again: 'ദയവായി പതുക്കെ ഒന്നുകൂടി പറയൂ.',
    },
  },
  'mr-IN': {
    lost: 'समजले नाही',
    family: 'कुटुंबीय',
    askDoctor: 'हे चिठ्ठीत नाही. कृपया तुमच्या डॉक्टरांना विचारा.',
    quick: {
      since: 'हे कधीपासून आहे?',
      where: 'कुठे दुखते आहे?',
      fever: 'ताप आहे का?',
      allergy: 'तुम्हाला कोणत्या औषधाची ॲलर्जी आहे का?',
      meds: 'सध्या कोणती औषधे घेत आहात?',
      again: 'कृपया हळू पुन्हा सांगा.',
    },
  },
  'gu-IN': {
    lost: 'સમજાયું નહીં',
    family: 'પરિવાર',
    askDoctor: 'આ ચિઠ્ઠીમાં નથી. કૃપા કરીને તમારા ડૉક્ટરને પૂછો.',
    quick: {
      since: 'આ ક્યારથી છે?',
      where: 'ક્યાં દુખે છે?',
      fever: 'તાવ છે?',
      allergy: 'તમને કોઈ દવાની એલર્જી છે?',
      meds: 'અત્યારે કઈ દવાઓ લો છો?',
      again: 'કૃપા કરીને ધીમેથી ફરી કહો.',
    },
  },
  'pa-IN': {
    lost: 'ਸਮਝ ਨਹੀਂ ਆਇਆ',
    family: 'ਪਰਿਵਾਰ',
    askDoctor: 'ਇਹ ਪਰਚੀ ਵਿੱਚ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਡਾਕਟਰ ਨੂੰ ਪੁੱਛੋ।',
    quick: {
      since: 'ਇਹ ਕਦੋਂ ਤੋਂ ਹੈ?',
      where: 'ਦਰਦ ਕਿੱਥੇ ਹੈ?',
      fever: 'ਬੁਖ਼ਾਰ ਹੈ?',
      allergy: 'ਕੀ ਤੁਹਾਨੂੰ ਕਿਸੇ ਦਵਾਈ ਤੋਂ ਐਲਰਜੀ ਹੈ?',
      meds: 'ਹੁਣ ਕਿਹੜੀਆਂ ਦਵਾਈਆਂ ਲੈ ਰਹੇ ਹੋ?',
      again: 'ਕਿਰਪਾ ਕਰਕੇ ਹੌਲੀ ਜਿਹੇ ਦੁਬਾਰਾ ਦੱਸੋ।',
    },
  },
  // Hinglish: Roman script, the way the interpreter writes it (see LANGUAGES['hi-Latn'].write).
  'hi-Latn': {
    lost: 'Samajh nahi aaya',
    family: 'Parivaar',
    askDoctor: 'Yeh parchi mein nahi hai. Please apne doctor se poochiye.',
    quick: {
      since: 'Yeh kab se hai?',
      where: 'Dard kahan hai?',
      fever: 'Bukhaar hai kya?',
      allergy: 'Kya aapko kisi dawai se allergy hai?',
      meds: 'Abhi kaun si dawaiyan le rahe hain?',
      again: 'Please dheere se phir bataiye.',
    },
  },
};

const EN = { lost: 'Did not understand', family: 'Family', askDoctor: 'That is not on this slip. Please ask your doctor.', quick: {} };
export const phrases = (lang) => PHRASES[lang] || EN;
