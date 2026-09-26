"""One-time script: add the auth field-validation keys to all locales."""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

KEYS = {
    'en': {
        'fullNameRequired': 'Full name is required',
        'nameMinLength': 'Name must be at least 2 characters',
        'usernameRequired': 'Username is required',
        'usernamePattern': '3-20 characters, letters, numbers, underscores only',
        'emailRequired': 'Email is required',
        'passwordRequired': 'Password is required',
        'passwordMinLength': 'At least 8 characters required',
        'confirmPasswordRequired': 'Please confirm your password',
    },
    'hi': {
        'fullNameRequired': 'पूरा नाम आवश्यक है',
        'nameMinLength': 'नाम कम से कम 2 अक्षरों का होना चाहिए',
        'usernameRequired': 'उपयोगकर्ता नाम आवश्यक है',
        'usernamePattern': 'केवल 3-20 अक्षर, अक्षर, संख्याएँ, अंडरस्कोर',
        'emailRequired': 'ईमेल आवश्यक है',
        'passwordRequired': 'पासवर्ड आवश्यक है',
        'passwordMinLength': 'कम से कम 8 अक्षर आवश्यक हैं',
        'confirmPasswordRequired': 'कृपया अपने पासवर्ड की पुष्टि करें',
    },
    'te': {
        'fullNameRequired': 'పూర్తి పేరు అవసరం',
        'nameMinLength': 'పేరు కనీసం 2 అక్షరాలు ఉండాలి',
        'usernameRequired': 'వినియోగదారు పేరు అవసరం',
        'usernamePattern': '3-20 అక్షరాలు, అక్షరాలు, సంఖ్యలు, అండర్‌స్కోర్‌లు మాత్రమే',
        'emailRequired': 'ఇమెయిల్ అవసరం',
        'passwordRequired': 'పాస్‌వర్డ్ అవసరం',
        'passwordMinLength': 'కనీసం 8 అక్షరాలు అవసరం',
        'confirmPasswordRequired': 'దయచేసి మీ పాస్‌వర్డ్‌ను నిర్ధారించండి',
    },
    'ta': {
        'fullNameRequired': 'முழுப் பெயர் தேவை',
        'nameMinLength': 'பெயர் குறைந்தது 2 எழுத்துகளாக இருக்க வேண்டும்',
        'usernameRequired': 'பயனர் பெயர் தேவை',
        'usernamePattern': '3-20 எழுத்துகள், எழுத்துக்கள், எண்கள், அடிக்கோடுகள் மட்டுமே',
        'emailRequired': 'மின்னஞ்சல் தேவை',
        'passwordRequired': 'கடவுச்சொல் தேவை',
        'passwordMinLength': 'குறைந்தது 8 எழுத்துகள் தேவை',
        'confirmPasswordRequired': 'தயவுசெய்து உங்கள் கடவுச்சொல்லை உறுதிப்படுத்தவும்',
    },
    'kn': {
        'fullNameRequired': 'ಪೂರ್ಣ ಹೆಸರು ಅಗತ್ಯವಿದೆ',
        'nameMinLength': 'ಹೆಸರು ಕನಿಷ್ಠ 2 ಅಕ್ಷರಗಳಾಗಿರಬೇಕು',
        'usernameRequired': 'ಬಳಕೆದಾರಹೆಸರು ಅಗತ್ಯವಿದೆ',
        'usernamePattern': '3-20 ಅಕ್ಷರಗಳು, ಅಕ್ಷರಗಳು, ಸಂಖ್ಯೆಗಳು, ಅಂಡರ್ಸ್ಕೋರ್‌ಗಳು ಮಾತ್ರ',
        'emailRequired': 'ಇಮೇಲ್ ಅಗತ್ಯವಿದೆ',
        'passwordRequired': 'ಪಾಸ್‌ವರ್ಡ್ ಅಗತ್ಯವಿದೆ',
        'passwordMinLength': 'ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು ಅಗತ್ಯವಿದೆ',
        'confirmPasswordRequired': 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
    },
    'ml': {
        'fullNameRequired': 'മുഴുവൻ പേര് ആവശ്യമാണ്',
        'nameMinLength': 'പേര് കുറഞ്ഞത് 2 പ്രതീകങ്ങളായിരിക്കണം',
        'usernameRequired': 'ഉപയോക്തൃനാമം ആവശ്യമാണ്',
        'usernamePattern': '3-20 പ്രതീകങ്ങൾ, അക്ഷരങ്ങൾ, അക്കങ്ങൾ, അടിവരകൾ മാത്രം',
        'emailRequired': 'ഇമെയിൽ ആവശ്യമാണ്',
        'passwordRequired': 'പാസ്‌വേഡ് ആവശ്യമാണ്',
        'passwordMinLength': 'കുറഞ്ഞത് 8 പ്രതീകങ്ങൾ ആവശ്യമാണ്',
        'confirmPasswordRequired': 'ദയവായി നിങ്ങളുടെ പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക',
    },
    'bn': {
        'fullNameRequired': 'পুরো নাম প্রয়োজন',
        'nameMinLength': 'নাম কমপক্ষে ২ অক্ষরের হতে হবে',
        'usernameRequired': 'ব্যবহারকারীর নাম প্রয়োজন',
        'usernamePattern': 'শুধু ৩-২০ অক্ষর, অক্ষর, সংখ্যা, আন্ডারস্কোর',
        'emailRequired': 'ইমেইল প্রয়োজন',
        'passwordRequired': 'পাসওয়ার্ড প্রয়োজন',
        'passwordMinLength': 'কমপক্ষে ৮ অক্ষর প্রয়োজন',
        'confirmPasswordRequired': 'দয়া করে আপনার পাসওয়ার্ড নিশ্চিত করুন',
    },
    'mr': {
        'fullNameRequired': 'पूर्ण नाव आवश्यक आहे',
        'nameMinLength': 'नाव किमान 2 अक्षरांचे असावे',
        'usernameRequired': 'वापरकर्तानाव आवश्यक आहे',
        'usernamePattern': 'फक्त 3-20 अक्षरे, अक्षरे, संख्या, अंडरस्कोर',
        'emailRequired': 'ईमेल आवश्यक आहे',
        'passwordRequired': 'पासवर्ड आवश्यक आहे',
        'passwordMinLength': 'किमान 8 अक्षरे आवश्यक आहेत',
        'confirmPasswordRequired': 'कृपया तुमच्या पासवर्डची पुष्टी करा',
    },
    'gu': {
        'fullNameRequired': 'પૂરું નામ જરૂરી છે',
        'nameMinLength': 'નામ ઓછામાં ઓછા 2 અક્ષરોનું હોવું જોઈએ',
        'usernameRequired': 'વપરાશકર્તા નામ જરૂરી છે',
        'usernamePattern': 'ફક્ત 3-20 અક્ષરો, અક્ષરો, સંખ્યાઓ, અંડરસ્કોર',
        'emailRequired': 'ઇમેઇલ જરૂરી છે',
        'passwordRequired': 'પાસવર્ડ જરૂરી છે',
        'passwordMinLength': 'ઓછામાં ઓછા 8 અક્ષરો જરૂરી છે',
        'confirmPasswordRequired': 'કૃપા કરીને તમારા પાસવર્ડની પુષ્ટિ કરો',
    },
    'pa': {
        'fullNameRequired': 'ਪੂਰਾ ਨਾਮ ਲੋੜੀਂਦਾ ਹੈ',
        'nameMinLength': 'ਨਾਮ ਘੱਟੋ ਘੱਟ 2 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ',
        'usernameRequired': 'ਉਪਭੋਗਤਾ ਨਾਮ ਲੋੜੀਂਦਾ ਹੈ',
        'usernamePattern': 'ਸਿਰਫ਼ 3-20 ਅੱਖਰ, ਅੱਖਰ, ਅੰਕ, ਅੰਡਰਸਕੋਰ',
        'emailRequired': 'ਈਮੇਲ ਲੋੜੀਂਦੀ ਹੈ',
        'passwordRequired': 'ਪਾਸਵਰਡ ਲੋੜੀਂਦਾ ਹੈ',
        'passwordMinLength': 'ਘੱਟੋ ਘੱਟ 8 ਅੱਖਰ ਲੋੜੀਂਦੇ ਹਨ',
        'confirmPasswordRequired': 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
    },
    'ur': {
        'fullNameRequired': 'پورا نام درکار ہے',
        'nameMinLength': 'نام کم از کم 2 حروف کا ہونا چاہیے',
        'usernameRequired': 'صارف نام درکار ہے',
        'usernamePattern': 'صرف 3-20 حروف، حروف، اعداد، انڈر اسکور',
        'emailRequired': 'ای میل درکار ہے',
        'passwordRequired': 'پاس ورڈ درکار ہے',
        'passwordMinLength': 'کم از کم 8 حروف درکار ہیں',
        'confirmPasswordRequired': 'براہ کرم اپنے پاس ورڈ کی تصدیق کریں',
    },
    'es': {
        'fullNameRequired': 'El nombre completo es obligatorio',
        'nameMinLength': 'El nombre debe tener al menos 2 caracteres',
        'usernameRequired': 'El nombre de usuario es obligatorio',
        'usernamePattern': 'Solo 3-20 caracteres, letras, números y guiones bajos',
        'emailRequired': 'El correo es obligatorio',
        'passwordRequired': 'La contraseña es obligatoria',
        'passwordMinLength': 'Se requieren al menos 8 caracteres',
        'confirmPasswordRequired': 'Por favor, confirma tu contraseña',
    },
    'fr': {
        'fullNameRequired': 'Le nom complet est obligatoire',
        'nameMinLength': 'Le nom doit contenir au moins 2 caractères',
        'usernameRequired': 'Le nom d\'utilisateur est obligatoire',
        'usernamePattern': '3-20 caractères : lettres, chiffres, tirets bas uniquement',
        'emailRequired': 'L\'e-mail est obligatoire',
        'passwordRequired': 'Le mot de passe est obligatoire',
        'passwordMinLength': 'Au moins 8 caractères requis',
        'confirmPasswordRequired': 'Veuillez confirmer votre mot de passe',
    },
    'de': {
        'fullNameRequired': 'Vollständiger Name ist erforderlich',
        'nameMinLength': 'Der Name muss mindestens 2 Zeichen haben',
        'usernameRequired': 'Benutzername ist erforderlich',
        'usernamePattern': 'Nur 3-20 Zeichen: Buchstaben, Zahlen, Unterstriche',
        'emailRequired': 'E-Mail ist erforderlich',
        'passwordRequired': 'Passwort ist erforderlich',
        'passwordMinLength': 'Mindestens 8 Zeichen erforderlich',
        'confirmPasswordRequired': 'Bitte bestätigen Sie Ihr Passwort',
    },
    'it': {
        'fullNameRequired': 'Il nome completo è obbligatorio',
        'nameMinLength': 'Il nome deve contenere almeno 2 caratteri',
        'usernameRequired': 'Il nome utente è obbligatorio',
        'usernamePattern': 'Solo 3-20 caratteri: lettere, numeri, trattini bassi',
        'emailRequired': 'L\'email è obbligatoria',
        'passwordRequired': 'La password è obbligatoria',
        'passwordMinLength': 'Sono richiesti almeno 8 caratteri',
        'confirmPasswordRequired': 'Conferma la tua password',
    },
    'pt': {
        'fullNameRequired': 'O nome completo é obrigatório',
        'nameMinLength': 'O nome deve ter pelo menos 2 caracteres',
        'usernameRequired': 'O nome de usuário é obrigatório',
        'usernamePattern': 'Apenas 3-20 caracteres: letras, números, sublinhados',
        'emailRequired': 'O e-mail é obrigatório',
        'passwordRequired': 'A senha é obrigatória',
        'passwordMinLength': 'São necessários pelo menos 8 caracteres',
        'confirmPasswordRequired': 'Confirme sua senha',
    },
    'zh': {
        'fullNameRequired': '请填写全名',
        'nameMinLength': '姓名至少需要2个字符',
        'usernameRequired': '请填写用户名',
        'usernamePattern': '仅3-20个字符：字母、数字、下划线',
        'emailRequired': '请填写邮箱',
        'passwordRequired': '请填写密码',
        'passwordMinLength': '至少需要8个字符',
        'confirmPasswordRequired': '请确认您的密码',
    },
    'ja': {
        'fullNameRequired': '氏名は必須です',
        'nameMinLength': '名前は2文字以上でなければなりません',
        'usernameRequired': 'ユーザー名は必須です',
        'usernamePattern': '3〜20文字：英字、数字、アンダースコアのみ',
        'emailRequired': 'メールアドレスは必須です',
        'passwordRequired': 'パスワードは必須です',
        'passwordMinLength': '8文字以上必要です',
        'confirmPasswordRequired': 'パスワードを確認してください',
    },
    'ko': {
        'fullNameRequired': '성명은 필수입니다',
        'nameMinLength': '이름은 최소 2자 이상이어야 합니다',
        'usernameRequired': '사용자 이름은 필수입니다',
        'usernamePattern': '3-20자: 문자, 숫자, 밑줄만 가능',
        'emailRequired': '이메일은 필수입니다',
        'passwordRequired': '비밀번호는 필수입니다',
        'passwordMinLength': '최소 8자 이상 필요합니다',
        'confirmPasswordRequired': '비밀번호를 확인해 주세요',
    },
    'ar': {
        'fullNameRequired': 'الاسم الكامل مطلوب',
        'nameMinLength': 'يجب أن يتكون الاسم من حرفين على الأقل',
        'usernameRequired': 'اسم المستخدم مطلوب',
        'usernamePattern': 'فقط 3-20 حرفًا: أحرف وأرقام وشرطات سفلية',
        'emailRequired': 'البريد الإلكتروني مطلوب',
        'passwordRequired': 'كلمة المرور مطلوبة',
        'passwordMinLength': 'مطلوب 8 أحرف على الأقل',
        'confirmPasswordRequired': 'يرجى تأكيد كلمة المرور الخاصة بك',
    },
}

def main():
    for code, keys in KEYS.items():
        path = os.path.join(BASE, code, 'translation.json')
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        auth = data['auth']
        for k, v in keys.items():
            auth[k] = v
        data['auth'] = auth
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'Updated {code}')

if __name__ == '__main__':
    main()
