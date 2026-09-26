import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  User, 
  Mail, 
  Lock, 
  MapPin, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  PhoneCall
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import meetupLogo from '../assets/images/meetup_app_logo_1790184081929.jpg';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase/config';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

const COUNTRY_OPTIONS = [
  { code: '+91', country: 'India', label: '+91 India' },
  { code: '+1', country: 'USA', label: '+1 USA' },
  { code: '+44', country: 'UK', label: '+44 UK' },
  { code: '+971', country: 'UAE', label: '+971 UAE' },
  { code: '+65', country: 'SG', label: '+65 Singapore' },
  { code: '+60', country: 'MY', label: '+60 Malaysia' },
];

// Floating Hearts decorative data for realistic drifting animations
const FLOATING_HEARTS = [
  { id: 1, left: '8%', size: 18, delay: '0s', duration: '14s', opacity: 0.45 },
  { id: 2, left: '18%', size: 26, delay: '3s', duration: '18s', opacity: 0.55 },
  { id: 3, left: '28%', size: 14, delay: '7s', duration: '12s', opacity: 0.35 },
  { id: 4, left: '42%', size: 22, delay: '1s', duration: '16s', opacity: 0.5 },
  { id: 5, left: '55%', size: 16, delay: '5s', duration: '15s', opacity: 0.4 },
  { id: 6, left: '68%', size: 28, delay: '2s', duration: '19s', opacity: 0.6 },
  { id: 7, left: '82%', size: 20, delay: '8s', duration: '13s', opacity: 0.45 },
  { id: 8, left: '92%', size: 15, delay: '4s', duration: '17s', opacity: 0.35 },
  { id: 9, left: '12%', size: 24, delay: '9s', duration: '20s', opacity: 0.5 },
  { id: 10, left: '35%', size: 18, delay: '11s', duration: '14s', opacity: 0.4 },
  { id: 11, left: '62%', size: 20, delay: '6s', duration: '16s', opacity: 0.5 },
  { id: 12, left: '76%', size: 15, delay: '12s', duration: '15s', opacity: 0.35 },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { 
    login, 
    loginWithGoogle, 
    register, 
    loginAsSuperAdmin,
    sendPhoneOtp,
    verifyPhoneLogin,
    verifyPhoneRegister
  } = useAuth();

  // Mode: Sign In vs Create Account
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // Method: Phone + OTP vs Email + Password
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');

  // Phone Auth States
  const [phoneStep, setPhoneStep] = useState<'enter_phone' | 'verify_otp'>('enter_phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  // Email Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Profile Fields (for Register mode)
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(23);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [location, setLocation] = useState('Chennai, Tamil Nadu');
  const [bio, setBio] = useState('');
  const [confirm18, setConfirm18] = useState(false);
  const [accountType, setAccountType] = useState<'user' | 'listener'>('user');

  // UI / Status states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Super Admin Password Popup States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [showAdminPasswordText, setShowAdminPasswordText] = useState(false);

  // Clear existing recaptcha verifier
  const clearExistingRecaptcha = (containerId: string = 'recaptcha-container') => {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Error clearing recaptchaVerifier in LoginPage:', e);
      }
      (window as any).recaptchaVerifier = null;
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  };

  // Initialize invisible reCAPTCHA on component mount
  useEffect(() => {
    clearExistingRecaptcha('recaptcha-container');

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          clearExistingRecaptcha('recaptcha-container');
        }
      });

      verifier.render().catch((err: any) => {
        console.warn('LoginPage recaptchaVerifier render warning:', err);
      });

      (window as any).recaptchaVerifier = verifier;
    } catch (err: any) {
      console.warn('Failed to initialize recaptchaVerifier on LoginPage mount:', err);
    }

    return () => {
      clearExistingRecaptcha('recaptcha-container');
    };
  }, []);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  // Clean formatted phone number with country code
  const getFullPhoneNumber = () => {
    const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
    return `${countryCode}${digitsOnly}`;
  };

  // Validate registration inputs
  const validateRegistrationFields = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return false;
    }
    if (Number(age) < 18) {
      setErrorMsg('You must be at least 18 years old to join Meet Up.');
      return false;
    }
    if (!confirm18) {
      setErrorMsg('Please confirm you are at least 18 years old.');
      return false;
    }
    return true;
  };

  // 1. Send OTP Handler
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const rawDigits = phoneNumber.replace(/[^0-9]/g, '');
    if (!rawDigits || rawDigits.length < 8) {
      setErrorMsg('Please enter a valid mobile number.');
      return;
    }

    if (mode === 'register' && !validateRegistrationFields()) {
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setSubmitting(true);

    try {
      const confResult = await sendPhoneOtp(fullPhone, 'recaptcha-container');
      setConfirmationResult(confResult);
      setPhoneStep('verify_otp');
      setCountdown(30);
      setInfoMsg(`OTP code sent to ${fullPhone}`);
    } catch (err: any) {
      console.error('Failed to send phone OTP:', err);
      setErrorMsg(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Resend OTP Handler
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setResending(true);

    const fullPhone = getFullPhoneNumber();
    try {
      const confResult = await sendPhoneOtp(fullPhone, 'recaptcha-container');
      setConfirmationResult(confResult);
      setCountdown(30);
      setInfoMsg(`A fresh OTP code has been resent to ${fullPhone}`);
    } catch (err: any) {
      console.error('Failed to resend phone OTP:', err);
      setErrorMsg(err.message || 'Could not resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // 3. Verify OTP Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanOtp = otpCode.trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    if (!confirmationResult) {
      setErrorMsg('Session expired. Please request a new OTP code.');
      setPhoneStep('enter_phone');
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await verifyPhoneLogin(confirmationResult, cleanOtp, fullPhone);
      } else {
        await verifyPhoneRegister(confirmationResult, cleanOtp, {
          phone: fullPhone,
          name: name.trim(),
          age: Number(age),
          gender,
          location: location.trim() || 'Chennai, Tamil Nadu',
          bio: bio.trim(),
          interests: ['Dating', 'Conversations', 'Music'],
          role: accountType,
        });
      }

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setErrorMsg(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Email Auth Handler
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && !validateRegistrationFields()) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(trimmedEmail, password);
      } else {
        await register({
          email: trimmedEmail,
          pass: password,
          name: name.trim(),
          age: Number(age),
          gender,
          location: location.trim() || 'Tamil Nadu, India',
          bio: bio.trim(),
          role: accountType,
        });
      }

      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Email authentication error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Google Sign In Handler
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google sign-in could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Super Admin Password Handler
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);

    if (adminPassword !== 'Raja@2026') {
      setAdminError('Access Denied: Incorrect Super Admin Password.');
      return;
    }

    setAdminVerifying(true);
    try {
      await loginAsSuperAdmin(adminPassword);
      setShowAdminModal(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setAdminError(err.message || 'Access Denied: Incorrect Super Admin Password.');
    } finally {
      setAdminVerifying(false);
    }
  };

  // Preset demo test number filler: "99765 43210" as shown in the screenshot
  const handleUseDemoNumber = () => {
    setCountryCode('+91');
    setPhoneNumber('9976543210');
    setErrorMsg(null);
    setInfoMsg('Demo number filled: +91 99765 43210');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden selection:bg-[#FF6BA9]/30 selection:text-[#FF6BA9]">
      
      {/* 1. TOP: FLOATING PINK HEARTS ANIMATION IN BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft top-down radial pink ambient glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] sm:w-[600px] h-[340px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255, 107, 169, 0.22), transparent 75%)',
          }}
        />

        {FLOATING_HEARTS.map((h) => (
          <div
            key={h.id}
            className="absolute animate-float-heart"
            style={{
              left: h.left,
              bottom: '-30px',
              animationDelay: h.delay,
              animationDuration: h.duration,
              opacity: h.opacity,
            }}
          >
            <svg 
              width={h.size} 
              height={h.size} 
              viewBox="0 0 24 24" 
              fill="#FF6BA9"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,107,169,0.7))' }}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Recaptcha Container for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      {/* Main Content Column (Max width 420px for true mobile fidelity) */}
      <div className="w-full max-w-[420px] z-10 flex flex-col items-center my-auto pt-2 pb-6">

        {/* 2. CENTER LOGO: Circular logo with neon pink border and green online dot */}
        <div 
          className="relative mb-3 cursor-pointer group"
          onDoubleClick={() => setShowAdminModal(true)}
          title="Double tap to open Admin access"
        >
          <div className="w-[84px] h-[84px] rounded-full p-[2px] bg-gradient-to-tr from-[#FF6BA9] to-[#FF85BA] shadow-[0_0_24px_rgba(255,107,169,0.65)] flex items-center justify-center">
            <img
              src={meetupLogo}
              alt="Meet Up Logo"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>
          {/* Small green online dot at bottom-right */}
          <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full bg-[#10B981] border-[2.5px] border-[#0A0A0A] shadow-[0_0_8px_#10B981] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white/90"></span>
          </div>
        </div>

        {/* 3. TITLE: "Meet Up" in large white serif font with neon pink hearts left and right */}
        <div className="flex items-center justify-center gap-3 mb-1">
          {/* Left twin neon hearts */}
          <span className="text-[#FF6BA9] inline-flex items-center drop-shadow-[0_0_8px_rgba(255,107,169,0.85)]">
            <svg width="28" height="22" viewBox="0 0 32 24" fill="none" stroke="#FF6BA9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 18.5l-1.1-1C5 13 2 10.5 2 7.2 2 4.5 4 2.5 6.7 2.5c1.5 0 3 .7 4 1.8 1-1.1 2.5-1.8 4-1.8 2.7 0 4.7 2 4.7 4.7 0 3.3-3 5.8-8.9 10.3L12 18.5z" />
              <path d="M21 16.5l-.8-.7C16 12 14 10 14 7.5c0-1.8 1.3-3.2 3.1-3.2 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.5-2 4.5-6.1 8.3L21 16.5z" opacity="0.85" />
            </svg>
          </span>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-wide text-white drop-shadow-sm select-none">
            Meet Up
          </h1>

          {/* Right pink dot + twin neon hearts */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6BA9] shadow-[0_0_8px_#FF6BA9]"></span>
            <span className="text-[#FF6BA9] inline-flex items-center drop-shadow-[0_0_8px_rgba(255,107,169,0.85)]">
              <svg width="28" height="22" viewBox="0 0 32 24" fill="none" stroke="#FF6BA9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 18.5l-1.1-1C5 13 2 10.5 2 7.2 2 4.5 4 2.5 6.7 2.5c1.5 0 3 .7 4 1.8 1-1.1 2.5-1.8 4-1.8 2.7 0 4.7 2 4.7 4.7 0 3.3-3 5.8-8.9 10.3L12 18.5z" />
                <path d="M21 16.5l-.8-.7C16 12 14 10 14 7.5c0-1.8 1.3-3.2 3.1-3.2 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.5-2 4.5-6.1 8.3L21 16.5z" opacity="0.85" />
              </svg>
            </span>
          </div>
        </div>

        {/* 4. SUBTITLE: "Sign in to continue" in grey */}
        <p className="text-zinc-400 text-sm font-normal mb-6">
          {phoneStep === 'verify_otp' 
            ? 'Enter the 6-digit code sent to your phone'
            : mode === 'register' 
              ? 'Create an account to continue' 
              : 'Sign in to continue'}
        </p>

        {/* Informational or Error feedback banner */}
        {errorMsg && (
          <div className="w-full p-3 mb-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
            <span className="leading-relaxed flex-1">{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="w-full p-3 mb-4 rounded-2xl bg-[#FF6BA9]/15 border border-[#FF6BA9]/40 text-pink-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#FF6BA9]" />
            <span className="leading-relaxed flex-1">{infoMsg}</span>
          </div>
        )}

        {/* 5. TWO PINK BUTTONS SIDE-BY-SIDE: "Sign In" and "Create Account" */}
        {phoneStep === 'enter_phone' && (
          <div className="w-full grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-3.5 px-4 rounded-2xl sm:rounded-3xl font-serif text-base font-semibold transition-all duration-200 cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_4px_22px_rgba(255,107,169,0.55)] scale-[1.01]'
                  : 'bg-[#FF6BA9]/80 text-white hover:bg-[#FF6BA9] opacity-90'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-3.5 px-4 rounded-2xl sm:rounded-3xl font-serif text-base font-semibold transition-all duration-200 cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_4px_22px_rgba(255,107,169,0.55)] scale-[1.01]'
                  : 'bg-[#FF6BA9]/80 text-white hover:bg-[#FF6BA9] opacity-90'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP A: ENTER PHONE / REGISTER / EMAIL FORM                  */}
        {/* ============================================================ */}
        {phoneStep === 'enter_phone' && (
          <div className="w-full space-y-4">

            {/* 6. TWO TOGGLE PILLS: "Mobile Number" (selected with pink icon) and "Email ID" */}
            <div className="grid grid-cols-2 gap-3 mb-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-medium transition cursor-pointer border ${
                  authMethod === 'phone'
                    ? 'border-[#FF6BA9] bg-[#16161F] text-white shadow-[0_0_12px_rgba(255,107,169,0.25)]'
                    : 'border-zinc-800 bg-[#121217] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <PhoneCall className={`w-3.5 h-3.5 ${authMethod === 'phone' ? 'text-[#FF6BA9]' : 'text-zinc-500'}`} />
                <span>Mobile Number</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-medium transition cursor-pointer border ${
                  authMethod === 'email'
                    ? 'border-[#FF6BA9] bg-[#16161F] text-white shadow-[0_0_12px_rgba(255,107,169,0.25)]'
                    : 'border-zinc-800 bg-[#121217] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Mail className={`w-3.5 h-3.5 ${authMethod === 'email' ? 'text-[#FF6BA9]' : 'text-zinc-500'}`} />
                <span>Email ID</span>
              </button>
            </div>

            {/* Extra fields if "Create Account" mode is chosen */}
            {mode === 'register' && (
              <div className="p-3.5 rounded-2xl bg-[#121217] border border-zinc-800/90 space-y-3 animate-in fade-in">
                <div>
                  <label className="text-xs text-zinc-300 font-medium block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Maya"
                      className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6BA9]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs text-zinc-300 font-medium block mb-1">Age (18+)</label>
                    <input
                      type="number"
                      min="18"
                      max="99"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF6BA9]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-300 font-medium block mb-1">I want to join as</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as any)}
                      className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#FF6BA9]"
                    >
                      <option value="user">Caller / User</option>
                      <option value="listener">🎧 Listener</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chk-18"
                    checked={confirm18}
                    onChange={(e) => setConfirm18(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-[#FF6BA9] focus:ring-[#FF6BA9]"
                  />
                  <label htmlFor="chk-18" className="text-[11px] text-zinc-400 cursor-pointer select-none">
                    I confirm I am at least <strong className="text-zinc-200">18 years of age</strong> and accept community guidelines.
                  </label>
                </div>
              </div>
            )}

            {/* FLOW 1: MOBILE NUMBER AUTH (Default as in screenshot) */}
            {authMethod === 'phone' ? (
              <form onSubmit={handleSendOtp} className="space-y-2">
                {/* 7. LABEL: "Mobile Number" */}
                <div className="text-left">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Mobile Number
                  </label>

                  {/* 8. PHONE INPUT: Left box "+91 India", Right box with phone icon and "99765 43210", pink border, dark fill */}
                  <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9] bg-[#121217] overflow-hidden shadow-[0_0_15px_rgba(255,107,169,0.15)] focus-within:shadow-[0_0_20px_rgba(255,107,169,0.3)] transition">
                    {/* Left box: +91 India with country selector */}
                    <div className="relative border-r border-zinc-800 shrink-0">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-transparent text-white text-xs font-medium pl-3 pr-6 py-3 appearance-none focus:outline-none cursor-pointer"
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code} className="bg-[#121217] text-white">
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">▼</span>
                    </div>

                    {/* Right box: phone icon and "99765 43210" */}
                    <div className="flex-1 flex items-center px-3 py-2.5 gap-2.5">
                      <PhoneCall className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="99765 43210"
                        className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none tracking-wider"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 9. RIGHT-ALIGNED SMALL TEXT: "Use demo number" in pink */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleUseDemoNumber}
                    className="text-[#FF6BA9] text-xs font-medium hover:underline cursor-pointer transition"
                  >
                    Use demo number
                  </button>
                </div>

                {/* 10. BIG PINK BUTTON: "Send OTP" with arrow icon on right */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] active:scale-[0.99] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? 'Sending OTP...' : 'Send OTP'}</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </form>
            ) : (
              /* FLOW 2: EMAIL & PASSWORD AUTH */
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div className="text-left">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Email Address
                  </label>
                  <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9] bg-[#121217] px-3.5 py-2.5 gap-2.5">
                    <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-transparent text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="text-left">
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Password
                  </label>
                  <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9] bg-[#121217] px-3.5 py-2.5 gap-2.5">
                    <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full bg-transparent text-xs font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? 'Authenticating...' : mode === 'register' ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              </form>
            )}

            {/* 11. DIVIDER: "or continue with" */}
            <div className="relative flex items-center justify-center my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <span className="relative px-4 bg-[#0A0A0A] text-xs italic text-zinc-400 font-serif">
                or continue with
              </span>
            </div>

            {/* 12. OUTLINED BUTTON: "Continue with Google" with Google G logo */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-2xl bg-[#121217] border border-zinc-800 hover:border-zinc-600 transition flex items-center justify-center gap-3 text-sm font-medium text-white cursor-pointer active:scale-[0.99]"
            >
              {/* Official Google G Logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.97 0 12s.45 3.86 1.24 5.42l4.04-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP B: VERIFY OTP SCREEN (Matches exact pink aesthetic)     */}
        {/* ============================================================ */}
        {phoneStep === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="w-full space-y-4 animate-in fade-in">
            <div className="p-4 rounded-2xl bg-[#121217] border border-zinc-800 text-center">
              <p className="text-xs text-zinc-400 mb-1">Code sent to:</p>
              <p className="text-sm font-semibold text-white tracking-wider mb-3">
                {getFullPhoneNumber()}
              </p>
              <button
                type="button"
                onClick={() => setPhoneStep('enter_phone')}
                className="text-xs text-[#FF6BA9] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Mobile Number</span>
              </button>
            </div>

            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                6-Digit Verification Code
              </label>
              <div className="rounded-2xl border-2 border-[#FF6BA9] bg-[#121217] px-3.5 py-3 shadow-[0_0_15px_rgba(255,107,169,0.2)]">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full bg-transparent text-center text-xl font-mono font-bold tracking-[0.4em] text-white placeholder:text-zinc-600 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-zinc-500">Didn't receive code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || resending}
                className="text-[#FF6BA9] font-medium hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : resending ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 pt-2"
            >
              <span>{submitting ? 'Verifying...' : 'Verify & Enter'}</span>
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
          </form>
        )}
      </div>

      {/* 13. BOTTOM: "Protected • Private & Encrypted" with shield icon */}
      <div className="w-full max-w-[420px] z-10 flex items-center justify-center gap-1.5 text-zinc-400 text-xs italic font-serif py-2 select-none">
        <Shield className="w-4 h-4 text-[#FF6BA9] shrink-0" />
        <span 
          onClick={() => setShowAdminModal(true)} 
          className="cursor-default hover:text-zinc-300 transition"
        >
          Protected • Private & Encrypted
        </span>
      </div>

      {/* SUPER ADMIN POPUP MODAL (Triggered via double-click on logo or footer) */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121217] border border-zinc-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Super Admin Security Access</h3>
            <p className="text-xs text-zinc-400 mb-3">Enter Master Key to access system control</p>
            
            {adminError && (
              <div className="p-2 mb-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-200 text-xs">
                {adminError}
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showAdminPasswordText ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-[#0A0A0A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF6BA9]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPasswordText(!showAdminPasswordText)}
                  className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                >
                  {showAdminPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminPassword('');
                    setAdminError(null);
                  }}
                  className="flex-1 py-2 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminVerifying}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#FF6BA9] hover:bg-[#FF7FB7] rounded-xl"
                >
                  {adminVerifying ? 'Verifying...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
