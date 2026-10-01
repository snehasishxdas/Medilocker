/**
 * MediLocker Multilingual Voice & Speech Synthesis Engine
 * Provides native TTS and Speech-to-Text across Indian Regional Languages:
 * English, Hindi, Bengali, Marathi, Telugu, Tamil, Urdu, Punjabi, Kannada
 */

export const SPEECH_LANG_MAP = {
  en: { bcp47: 'en-IN', dialect: 'English', fallbackBcp47: 'en-US', label: 'English' },
  hi: { bcp47: 'hi-IN', dialect: 'Hindi / Bhojpuri', fallbackBcp47: 'hi-IN', label: 'हिंदी' },
  bn: { bcp47: 'bn-IN', dialect: 'Bengali', fallbackBcp47: 'bn-BD', label: 'বাংলা' },
  mr: { bcp47: 'mr-IN', dialect: 'Marathi', fallbackBcp47: 'mr-IN', label: 'मराठी' },
  te: { bcp47: 'te-IN', dialect: 'Telugu', fallbackBcp47: 'te-IN', label: 'తెలుగు' },
  ta: { bcp47: 'ta-IN', dialect: 'Tamil', fallbackBcp47: 'ta-IN', label: 'தமிழ்' },
  ur: { bcp47: 'ur-IN', dialect: 'Urdu', fallbackBcp47: 'ur-PK', label: 'اردو' },
  pa: { bcp47: 'pa-IN', dialect: 'Punjabi', fallbackBcp47: 'pa-PK', label: 'ਪੰਜਾਬੀ' },
  kn: { bcp47: 'kn-IN', dialect: 'Kannada', fallbackBcp47: 'kn-IN', label: 'ಕನ್ನಡ' },
};

export const KIOSK_AUDIO_PROMPTS = {
  en: {
    guide: 'Please touch the body area on screen where you feel discomfort, or tap the microphone to speak and generate your OPD slip.',
    emergency: 'Warning: Emergency condition detected. Please proceed directly to Room Number 1 immediately.',
    ticketReady: (num) => `OPD Ticket number ${num} is ready. Please take a seat in the waiting hall.`,
    heard: (txt) => `Heard: ${txt}`,
    welcome: (name) => `Hello ${name}, your health record has been retrieved.`,
    needName: 'Please enter patient name',
    needArea: 'Please touch the discomfort area on the body map',
    needSymptom: 'Please choose the type of trouble you are experiencing',
  },
  hi: {
    guide: 'कृपया स्क्रीन पर उस अंग को छुएं जहाँ दर्द है, या माइक दबाकर बोलें और अपनी पर्ची निकालें।',
    emergency: 'चेतावनी: आपातकालीन स्थिति। तुरंत कमरा नंबर 1 में जाएं।',
    ticketReady: (num) => `पर्ची संख्या ${num} तैयार है। कृपया प्रतीक्षालय में बैठें।`,
    heard: (txt) => `सुना गया: ${txt}`,
    welcome: (name) => `नमस्ते ${name}, आपका रिकॉर्ड मिल गया है।`,
    needName: 'कृपया मरीज का नाम दर्ज करें',
    needArea: 'कृपया शरीर के उस हिस्से को छुएं जहाँ दर्द है',
    needSymptom: 'कृपया तकलीफ का प्रकार चुनें',
  },
  bn: {
    guide: 'স্ক্রিনে যেখানে কষ্ট বা ব্যথা হচ্ছে সেই অংশটি স্পর্শ করুন, অথবা মাইকে কথা বলে আপনার ওপিডি স্লিপ সংগ্রহ করুন।',
    emergency: 'সতর্কতা: জরুরি অবস্থা। অবিলম্বে ১ নম্বর ওপিডি রুমে যান।',
    ticketReady: (num) => `ওপিডি স্লিপ নম্বর ${num} প্রস্তুত হয়েছে। অনুগ্রহ করে ওয়েটিং হলে অপেক্ষা করুন।`,
    heard: (txt) => `শোনা গেছে: ${txt}`,
    welcome: (name) => `নমস্কার ${name}, আপনার স্বাস্থ্য রেকর্ড পাওয়া গেছে।`,
    needName: 'অনুগ্রহ করে রোগীর নাম লিখুন',
    needArea: 'অনুগ্রহ করে শরীরের ব্যথার অংশটি স্পর্শ করুন',
    needSymptom: 'অনুগ্রহ করে কষ্টের লক্ষণ বেছে নিন',
  },
  mr: {
    guide: 'कृपया स्क्रीनवर ज्या भागामध्ये वेदना होत आहेत त्याला स्पर्श करा किंवा माइक दाबून बोला आणि तुमची ओपीडी पावती मिळवा.',
    emergency: 'धोका: आपत्कालीन परिस्थिती. कृपया त्वरित रूम नंबर १ मध्ये जा.',
    ticketReady: (num) => `ओपीडी पावती क्रमांक ${num} तयार आहे. कृपया प्रतीक्षालयात बसा.`,
    heard: (txt) => `ऐकले: ${txt}`,
    welcome: (name) => `नमस्कार ${name}, आपला वैद्यकीय रेकॉर्ड सापडला आहे.`,
    needName: 'कृपया रुग्णाचे नाव प्रविष्ट करा',
    needArea: 'कृपया शरीरावर वेदना असलेली जागा निवडा',
    needSymptom: 'कृपया त्रासाचा प्रकार निवडा',
  },
  te: {
    guide: 'దయచేసి స్క్రీన్‌పై నొప్పి ఉన్న భాగాన్ని తాకండి లేదా మైక్ నొక్కి మాట్లాడి మీ ఓపీడీ స్లిప్‌ను పొందండి.',
    emergency: 'హెచ్చరిక: అత్యవసర పరిస్థితి. వెంటనే రూమ్ నంబర్ 1 కి వెళ్ళండి.',
    ticketReady: (num) => `ఓపీడీ స్లిప్ నంబర్ ${num} సిద్ధంగా ఉంది. దయచేసి వెయిటింగ్ హాల్‌లో కూర్చోండి.`,
    heard: (txt) => `వినిపించింది: ${txt}`,
    welcome: (name) => `నమస్కారం ${name}, మీ ఆరోగ్య రికార్డు కనుగొనబడింది.`,
    needName: 'దయచేసి రోగి పేరును నమోదు చేయండి',
    needArea: 'దయచేసి శరీరంలో అసౌకర్యం ఉన్న భాగాన్ని తాకండి',
    needSymptom: 'దయచేసి సమస్య రకాన్ని ఎంచుకోండి',
  },
  ta: {
    guide: 'திரையில் வலி உள்ள பகுதியைத் தொடவும் அல்லது மைக்கை அழுத்திப் பேசி உங்கள் ஓபிடி சீட்டைப் பெறவும்.',
    emergency: 'எச்சரிக்கை: அவசர நிலை. உடனடியாக அறை எண் 1 க்குச் செல்லவும்.',
    ticketReady: (num) => `ஓபிடி சீட்டு எண் ${num} தயாராக உள்ளது. காத்திருப்பு அறையில் அமரவும்.`,
    heard: (txt) => `கேட்கப்பட்டது: ${txt}`,
    welcome: (name) => `வணக்கம் ${name}, உங்கள் மருத்துவக் குறிப்பு பெறப்பட்டது.`,
    needName: 'தயவுசெய்து நோயாளியின் பெயரை உள்ளிடவும்',
    needArea: 'உடலில் வலி உள்ள பகுதியைத் தொடவும்',
    needSymptom: 'பிரச்சினையின் வகையைத் தேர்ந்தெடுக்கவும்',
  },
  ur: {
    guide: 'براہ کرم اسکرین پر اس حصے کو چھوئیں جہاں درد ہے، یا مائیک دبا کر بولیں اور اپنی او پی ڈی پرچی حاصل کریں۔',
    emergency: 'انتباہ: ہنگامی صورتحال۔ فوراً کمرہ نمبر 1 میں تشریف لے جائیں۔',
    ticketReady: (num) => `او پی ڈی پرچی نمبر ${num} تیار ہے۔ برائے مہربانی ویٹنگ ہال میں بیٹھیں۔`,
    heard: (txt) => `سنا گیا: ${txt}`,
    welcome: (name) => `السلام علیکم ${name}، آپ کا ریکارڈ مل گیا ہے۔`,
    needName: 'براہ کرم مریض کا نام درج کریں',
    needArea: 'براہ کرم جسم پر تکلیف کی جگہ منتخب کریں',
    needSymptom: 'براہ کرم تکلیف کی قسم منتخب کریں',
  },
  pa: {
    guide: 'ਕਿਰਪਾ ਕਰਕੇ ਸਕ੍ਰੀਨ ਉੱਤੇ ਉਸ ਅੰਗ ਨੂੰ ਛੂਹੋ ਜਿੱਥੇ ਦਰਦ ਹੈ, ਜਾਂ ਮਾਈਕ ਦਬਾ ਕੇ ਬੋਲੋ ਅਤੇ ਆਪਣੀ ਪਰਚੀ ਪ੍ਰਾਪਤ ਕਰੋ।',
    emergency: 'ਚੇਤਾਵਨੀ: ਐਮਰਜੈਂਸੀ ਸਥਿਤੀ। ਤੁਰੰਤ ਕਮਰਾ ਨੰਬਰ 1 ਵਿੱਚ ਜਾਓ।',
    ticketReady: (num) => `ਓਪੀਡੀ ਪਰਚੀ ਨੰਬਰ ${num} ਤਿਆਰ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਵੇਟਿੰਗ ਹਾਲ ਵਿੱਚ ਬੈਠੋ।`,
    heard: (txt) => `ਸੁਣਿਆ ਗਿਆ: ${txt}`,
    welcome: (name) => `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name}, ਤੁਹਾਡਾ ਰਿਕਾਰਡ ਮਿਲ ਗਿਆ ਹੈ।`,
    needName: 'ਕਿਰਪਾ ਕਰਕੇ ਮਰੀਜ਼ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ',
    needArea: 'ਕਿਰਪਾ ਕਰਕੇ ਸਰੀਰ ਦੇ ਉਸ ਹਿੱਸੇ ਨੂੰ ਛੂਹੋ ਜਿੱਥੇ ਦਰਦ ਹੈ',
    needSymptom: 'ਕਿਰਪਾ ਕਰਕੇ ਤਕਲੀਫ਼ ਦੀ ਕਿਸਮ ਚੁਣੋ',
  },
  kn: {
    guide: 'ದಯವಿಟ್ಟು ಪರದೆಯ ಮೇಲೆ ನೋವಿರುವ ಅಂಗವನ್ನು ಸ್ಪರ್ಶಿಸಿ, ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಒಪಿಡಿ ಚೀಟಿಯನ್ನು ಪಡೆಯಿರಿ.',
    emergency: 'ಎಚ್ಚರಿಕೆ: ತುರ್ತು ಪರಿಸ್ಥಿತಿ. ತಕ್ಷಣ ಕೊಠಡಿ ಸಂಖ್ಯೆ 1 ಕ್ಕೆ ತೆರಳಿ.',
    ticketReady: (num) => `ಒಪಿಡಿ ಚೀಟಿ ಸಂಖ್ಯೆ ${num} ಸಿದ್ಧವಾಗಿದೆ. ದಯವಿಟ್ಟು ಕಾಯುವ ಕೋಣೆಯಲ್ಲಿ ಕುಳಿತುಕೊಳ್ಳಿ.`,
    heard: (txt) => `ಕೇಳಿಸಿದೆ: ${txt}`,
    welcome: (name) => `ನಮಸ್ಕಾರ ${name}, ನಿಮ್ಮ ಆರೋಗ್ಯ ದಾಖಲೆ ಸಿಕ್ಕಿದೆ.`,
    needName: 'ದಯವಿಟ್ಟು ರೋಗಿಯ ಹೆಸರನ್ನು ನಮೂದಿಸಿ',
    needArea: 'ದಯವಿಟ್ಟು ದೇಹದಲ್ಲಿ ನೋವಿರುವ ಭಾಗವನ್ನು ಸ್ಪರ್ಶಿಸಿ',
    needSymptom: 'ದಯವಿಟ್ಟು ತೊಂದರೆಯ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  },
};

export const COMPANION_PROMPTS = {
  en: {
    welcome: 'Hello! I am your Medi-AI Clinical Companion. Describe your symptoms or tap the mic button to speak.',
    placeholder: 'Type or speak your symptoms (e.g. Sharp pain in chest since morning)...',
    analyzing: 'Analyzing symptoms and evaluating clinical SOCRATES matrix...',
    saved: 'Clinical intake and investigations saved to your sovereign health vault.',
    listening: 'Listening... Speak naturally in English',
    fallback: 'Please describe your symptoms in detail so an accurate clinical evaluation can be conducted.',
  },
  hi: {
    welcome: 'नमस्ते! मैं आपका मेडी-एआई क्लिनिकल साथी हूँ। अपनी समस्या या लक्षण बताएं या माइक बटन दबाकर बोलें।',
    placeholder: 'अपने लक्षण लिखें या बोलें (उदा. सुबह से छाती में तेज दर्द है)...',
    analyzing: 'लक्षणों का विश्लेषण और सोक्रेट्स मैट्रिक्स तैयार किया जा रहा है...',
    saved: 'क्लिनिकल इनटेक और जांच आपके स्वास्थ्य लॉकर में सुरक्षित सहेज दी गई है।',
    listening: 'सुन रहे हैं... हिंदी में बोलें',
    fallback: 'कृपया अपने लक्षण विस्तार से बताएं ताकि सटीक क्लिनिकल विश्लेषण किया जा सके।',
  },
  bn: {
    welcome: 'নমস্কার! আমি আপনার মেডি-এআই ক্লিনিকাল সঙ্গী। আপনার লক্ষণ বা শারীরিক সমস্যা জানান অথবা মাইক চেপে কথা বলুন।',
    placeholder: 'আপনার সমস্যা লিখুন বা বলুন (যেমন: সকাল থেকে বুকে তীব্র ব্যথা)...',
    analyzing: 'লক্ষণ বিশ্লেষণ এবং সোক্রেটিস ম্যাট্রিক্স মূল্যায়ন করা হচ্ছে...',
    saved: 'ক্লিনিকাল তথ্য এবং প্রয়োজনীয় পরীক্ষা আপনার হেলথ লকারে সংরক্ষিত হয়েছে।',
    listening: 'শুনছি... বাংলায় বলুন',
    fallback: 'সঠিক মূল্যায়নের জন্য অনুগ্রহ করে আপনার লক্ষণগুলি বিস্তারিতভাবে বলুন।',
  },
  mr: {
    welcome: 'नमस्कार! मी आपला मेडी-एআই क्लिनिकल साथी आहे. आपली लक्षणे सांगा किंवा माइक दाबून बोला.',
    placeholder: 'आपली लक्षणे टाइप करा किंवा बोला (उदा. सकाळपासून छातीत तीक्ष्ण वेदना होत आहेत)...',
    analyzing: 'लक्षणांचे विश्लेषण व सोक्रेट्स मॅट्रिक्स तयार केले जात आहे...',
    saved: 'क्लिनिकल माहिती व तपासण्या आपल्या हेल्थ लॉकरमध्ये सुरक्षित सेव्ह झाल्या आहेत.',
    listening: 'ऐकत आहे... मराठीत बोला',
    fallback: 'अचूक विश्लेषणासाठी कृपया आपली लक्षणे सविस्तरपणे सांगा.',
  },
  te: {
    welcome: 'నమస్కారం! నేను మీ మెడి-AI క్లినికల్ సహాయకుడిని. మీ లక్షణాలను తెలియజేయండి లేదా మాట్లాడటానికి మైక్ నొక్కండి.',
    placeholder: 'మీ లక్షణాలను టైప్ చేయండి లేదా మాట్లాడండి (ఉదా: ఉదయం నుండి ఛాతీలో తీవ్రమైన నొప్పి)...',
    analyzing: 'లక్షణాల విశ్లేషణ మరియు సోక్రటీస్ మ్యాట్రిక్స్ మూల్యాంకనం చేయబడుతోంది...',
    saved: 'క్లినికల్ సమాచారం మీ హెల్త్ లాకర్‌లో సురక్షితంగా భద్రపరచబడింది.',
    listening: 'వింటున్నాను... తెలుగులో మాట్లాడండి',
    fallback: 'ఖచ్చితమైన విశ్లేషణ కోసం దయచేసి మీ లక్షణాలను వివరంగా చెప్పండి.',
  },
  ta: {
    welcome: 'வணக்கம்! நான் உங்கள் மெடி-AI மருத்துவ உதவியாளர். உங்கள் அறிகுறிகளை விவரிக்கவும் அல்லது மைக் அழுத்திப் பேசவும்.',
    placeholder: 'உங்கள் அறிகுறிகளை தட்டச்சு செய்யவும் அல்லது பேசவும் (எ.கா. காலையிலிருந்து நெஞ்சு வலி)...',
    analyzing: 'அறிகுறிகள் பகுப்பாய்வு செய்யப்பட்டு வருகின்றன...',
    saved: 'மருத்துவத் தகவல்கள் உங்கள் ஹெல்த் ಲಾக்கரில் வெற்றிகரமாகச் சேமிக்கப்பட்டன.',
    listening: 'கேட்கிறேன்... தமிழில் பேசவும்',
    fallback: 'துல்லியமான பகுப்பாய்வுக்கு உங்கள் அறிகுறிகளை விரிவாக விவரிக்கவும்.',
  },
  ur: {
    welcome: 'السلام علیکم! میں آپ کا میڈی-اے آئی کلینکل ساتھی ہوں۔ اپنی علامات بیان کریں یا بولنے کے لیے مائیک دبائیں۔',
    placeholder: 'اپنی علامات لکھیں یا بولیں (مثلاً صبح سے سینے میں شدید درد ہے)...',
    analyzing: 'علامات کا تجزیہ اور سوکریٹس میٹرکس تیار کیا جا رہا ہے۔۔۔',
    saved: 'کلینکل ریکارڈ آپ کے ہیلتھ لاکر میں محفوظ کر دیا گیا ہے۔',
    listening: 'سن رہے ہیں... اردو میں بولیں',
    fallback: 'درست تشخیص کے لیے براہ کرم اپنی علامات تفصیل سے بیان کریں۔',
  },
  pa: {
    welcome: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ ਮੇਡੀ-ਏਆਈ ਕਲੀਨਿਕਲ ਸਾਥੀ ਹਾਂ। ਆਪਣੇ ਲੱਛਣ ਦੱਸੋ ਜਾਂ ਬੋਲਣ ਲਈ ਮਾਈਕ ਦਬਾਓ।',
    placeholder: 'ਆਪਣੇ ਲੱਛਣ ਲਿਖੋ ਜਾਂ ਬੋਲੋ (ਜਿਵੇਂ ਸਵੇਰ ਤੋਂ ਛਾਤੀ ਵਿੱਚ ਤੇਜ਼ ਦਰਦ ਹੈ)...',
    analyzing: 'ਲੱਛਣਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਅਤੇ ਸੋਕ੍ਰੇਟੀਜ਼ ਮੈਟ੍ਰਿਕਸ ਤਿਆਰ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...',
    saved: 'ਕਲੀਨਿਕਲ ਰਿਕਾਰਡ ਤੁਹਾਡੇ ਹੈਲਥ ਲਾਕਰ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਸੰਭਾਲਿਆ ਗਿਆ ਹੈ।',
    listening: 'ਸੁਣ ਰਹੇ ਹਾਂ... ਪੰਜਾਬੀ ਵਿੱਚ ਬੋਲੋ',
    fallback: 'ਸਹੀ ਜਾਂਚ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਲੱਛਣ ਵਿਸਥਾਰ ਨਾਲ ਦੱਸੋ।',
  },
  kn: {
    welcome: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಮೆಡಿ-AI ಕ್ಲಿನಿಕಲ್ ಸಹಾಯಕ. ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ತಿಳಿಸಿ ಅಥವಾ ಮಾತನಾಡಲು ಮೈಕ್ ಒತ್ತಿರಿ.',
    placeholder: 'ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ಬರೆಯಿರಿ ಅಥವಾ ಮಾತನಾಡಿ (ಉದಾ. ಮುಂಜಾನೆಯಿಂದ ಎದೆನೋವು)...',
    analyzing: 'ರೋಗಲಕ್ಷಣಗಳ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಸಾಕ್ರಟೀಸ್ ಮ್ಯಾಟ್ರಿಕ್ಸ್ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    saved: 'ಕ್ಲಿನಿಕಲ್ ವಿವರಗಳು ನಿಮ್ಮ ಹೆಲ್ತ್ ಲಾಕರ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ಉಳಿಸಲಾಗಿದೆ.',
    listening: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ... ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
    fallback: 'ನಿಖರವಾದ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ದಯವಿಟ್ಟು ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ವಿವರವಾಗಿ ತಿಳಿಸಿ.',
  },
};

/**
 * Find the best installed TTS voice matching the language
 */
export function findMatchingVoice(langCode = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const cfg = SPEECH_LANG_MAP[langCode] || SPEECH_LANG_MAP.en;
  const targetTag = cfg.bcp47.toLowerCase();
  const fallbackTag = (cfg.fallbackBcp47 || '').toLowerCase();
  const langPrefix = langCode.toLowerCase();

  // 1. Exact match (e.g. bn-IN, hi-IN, mr-IN)
  let matched = voices.find((v) => v.lang.toLowerCase() === targetTag);
  if (matched) return matched;

  // 2. Fallback regional match (e.g. bn-BD, ur-PK)
  if (fallbackTag) {
    matched = voices.find((v) => v.lang.toLowerCase() === fallbackTag);
    if (matched) return matched;
  }

  // 3. Prefix match (e.g. starts with 'bn', 'mr', 'te', 'ta', 'ur', 'hi', 'en')
  matched = voices.find((v) => v.lang.toLowerCase().replace(/_/g, '-').startsWith(langPrefix));
  if (matched) return matched;

  // 4. Voice name contains language name
  matched = voices.find(
    (v) =>
      v.name.toLowerCase().includes(cfg.label.toLowerCase()) ||
      v.name.toLowerCase().includes(cfg.dialect.toLowerCase())
  );
  if (matched) return matched;

  // 5. Default device voice
  return voices.find((v) => v.default) || voices[0] || null;
}

/**
 * Speak text in the target language
 */
export function speakInLanguage(text, langCode = 'en', options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!text || typeof text !== 'string') return;

  try {
    window.speechSynthesis.cancel(); // Stop any pending utterances
    const utterance = new SpeechSynthesisUtterance(text);
    const cfg = SPEECH_LANG_MAP[langCode] || SPEECH_LANG_MAP.en;

    utterance.lang = cfg.bcp47;
    utterance.rate = options.rate || 0.92;
    utterance.pitch = options.pitch || 1.0;

    const voice = findMatchingVoice(langCode);
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Multilingual TTS playback error:', err);
  }
}

/**
 * Configure Speech Recognition instance for target language
 */
export function getRecognitionLanguage(langCode = 'en') {
  const cfg = SPEECH_LANG_MAP[langCode] || SPEECH_LANG_MAP.en;
  return cfg.bcp47;
}
