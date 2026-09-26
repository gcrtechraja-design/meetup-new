import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  User, 
  Mail, 
  Lock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  X,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase/config';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+1', country: 'US', label: 'USA / Canada (+1)' },
  { code: '+44', country: 'GB', label: 'UK (+44)' },
  { code: '+971', country: 'AE', label: 'UAE (+971)' },
  { code: '+65', country: 'SG', label: 'Singapore (+65)' },
  { code: '+60', country: 'MY', label: 'Malaysia (+60)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    login, 
    loginWithGoogle, 
    register, 
    loginAsSuperAdmin,
    sendPhoneOtp,
    verifyPhoneLogin,
    verifyPhoneRegister
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');

  // Phone Auth states
  const [phoneStep, setPhoneStep] = useState<'enter_phone' | 'verify_otp'>('enter_phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  // Email Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Profile fields for Register
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(23);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [location, setLocation] = useState('Chennai, Tamil Nadu');
  const [bio, setBio] = useState('');
  const [confirm18, setConfirm18] = useState(false);

  // Status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Super Admin Popup
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminVerifying, setAdminVerifying] = useState(false);
  const [showAdminPasswordText, setShowAdminPasswordText] = useState(false);

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

  // Helper to safely clear existing recaptcha verifier
  const clearExistingRecaptcha = (containerId: string = 'modal-recaptcha-container') => {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Error clearing recaptchaVerifier in AuthModal:', e);
      }
      (window as any).recaptchaVerifier = null;
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  };

  // Initialize invisible reCAPTCHA only once on component mount / modal open
  useEffect(() => {
    if (!isOpen) {
      clearExistingRecaptcha('modal-recaptcha-container');
      return;
    }

    // Check if window.recaptchaVerifier exists, if yes clear it
    clearExistingRecaptcha('modal-recaptcha-container');

    // Create and initialize after DOM is mounted
    const timer = setTimeout(() => {
      let container = document.getElementById('modal-recaptcha-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'modal-recaptcha-container';
        document.body.appendChild(container);
      }

      try {
        // Use invisible reCAPTCHA and clear existing verifier before creating new one
        const verifier = new RecaptchaVerifier(auth, 'modal-recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            console.warn('AuthModal reCAPTCHA expired, clearing verifier');
            clearExistingRecaptcha('modal-recaptcha-container');
          }
        });

        // Make recaptchaVerifier render only once
        verifier.render().catch((err: any) => {
          console.warn('AuthModal recaptchaVerifier render warning:', err);
        });

        (window as any).recaptchaVerifier = verifier;
      } catch (err: any) {
        console.warn('Failed to initialize recaptchaVerifier in AuthModal:', err);
      }
    }, 50);

    // Cleanup on unmount or modal close
    return () => {
      clearTimeout(timer);
      clearExistingRecaptcha('modal-recaptcha-container');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getFullPhoneNumber = () => {
    const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
    return `${countryCode}${digitsOnly}`;
  };

  const validateRegistration = (): boolean => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return false;
    }
    if (Number(age) < 18) {
      setErrorMsg('You must be at least 18 years old to join Meet Up.');
      return false;
    }
    if (!confirm18) {
      setErrorMsg('You must confirm you are 18+ years old.');
      return false;
    }
    return true;
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const rawDigits = phoneNumber.replace(/[^0-9]/g, '');
    if (!rawDigits || rawDigits.length < 8) {
      setErrorMsg('Please enter a valid phone number (minimum 8 digits).');
      return;
    }

    if (mode === 'register' && !validateRegistration()) {
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setSubmitting(true);
    try {
      const confResult = await sendPhoneOtp(fullPhone, 'modal-recaptcha-container');
      setConfirmationResult(confResult);
      setPhoneStep('verify_otp');
      setCountdown(30);
      setInfoMsg(`OTP code has been sent to ${fullPhone}`);
    } catch (err: any) {
      console.error('Phone OTP send failed:', err);
      setErrorMsg(err.message || 'Failed to send OTP code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setResending(true);

    const fullPhone = getFullPhoneNumber();
    try {
      const confResult = await sendPhoneOtp(fullPhone, 'modal-recaptcha-container');
      setConfirmationResult(confResult);
      setCountdown(30);
      setInfoMsg(`A fresh OTP code has been resent to ${fullPhone}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

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
        });
      }
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && !validateRegistration()) {
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
        });
      }
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

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
      if (onClose) onClose();
    } catch (err: any) {
      setAdminError(err.message || 'Access Denied: Incorrect Super Admin Password.');
    } finally {
      setAdminVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div 
        className="w-full max-w-md bg-[#0E0E13] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative my-auto max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <img
            src={appLogo}
            alt="Meet Up Logo"
            className="w-14 h-14 rounded-full object-cover border-2 border-[#FF69B4] shadow-[0_0_15px_rgba(255,105,180,0.5)] mb-2"
          />
          <h2 className="text-xl font-black text-white">Meet Up</h2>
          <p className="text-xs text-zinc-400">
            {mode === 'login' ? 'Sign in to start live audio & video calls' : 'Join Meet Up community (18+)'}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 p-1 bg-[#14141A] rounded-xl border border-zinc-800 mb-3">
          <button
            type="button"
            onClick={() => { 
              setMode('login'); 
              setPhoneStep('enter_phone'); 
              setErrorMsg(null); 
              setInfoMsg(null);
            }}
            className={`py-1.5 text-xs font-bold rounded-lg transition ${
              mode === 'login'
                ? 'bg-[#FF69B4] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { 
              setMode('register'); 
              setPhoneStep('enter_phone'); 
              setErrorMsg(null); 
              setInfoMsg(null);
            }}
            className={`py-1.5 text-xs font-bold rounded-lg transition ${
              mode === 'register'
                ? 'bg-[#FF69B4] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Sub-method tabs */}
        {phoneStep === 'enter_phone' && (
          <div className="flex p-1 bg-[#121218] rounded-xl border border-zinc-800/80 mb-3">
            <button
              type="button"
              onClick={() => { setAuthMethod('phone'); setErrorMsg(null); setInfoMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                authMethod === 'phone' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-[#FF69B4]" />
              <span>Phone + OTP</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('email'); setErrorMsg(null); setInfoMsg(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                authMethod === 'email' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>Email & Password</span>
            </button>
          </div>
        )}

        {/* Error/Info Alerts */}
        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="p-3 mb-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{infoMsg}</span>
          </div>
        )}

        <div id="modal-recaptcha-container"></div>

        {/* PHONE FLOW */}
        {authMethod === 'phone' && (
          <>
            {phoneStep === 'enter_phone' ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Age (18+)</label>
                        <input
                          type="number"
                          min="18"
                          value={age}
                          onChange={(e) => setAge(Number(e.target.value))}
                          className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF69B4]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Gender</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value as any)}
                          className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF69B4]"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirm18}
                          onChange={(e) => setConfirm18(e.target.checked)}
                          className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-[#FF69B4]"
                        />
                        <span className="text-[11px] text-zinc-300">
                          I confirm I am 18+ years old and agree to Guidelines.
                        </span>
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-zinc-300">Phone Number</label>
                    <button
                      type="button"
                      onClick={() => { setCountryCode('+91'); setPhoneNumber('9999999999'); }}
                      className="text-[10px] text-[#FF69B4] hover:underline"
                    >
                      Fill Demo Number
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-24 bg-[#14141A] border border-zinc-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none font-mono"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="98765 43210"
                      className="flex-1 bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4] font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#E0559E] hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,105,180,0.4)] disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      <span>{mode === 'login' ? 'Send OTP to Sign In' : 'Send OTP to Create Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* OTP VERIFICATION STEP */
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="p-3 bg-[#14141A] border border-zinc-800 rounded-xl text-center relative">
                  <button
                    type="button"
                    onClick={() => { setPhoneStep('enter_phone'); setOtpCode(''); }}
                    className="absolute left-2.5 top-2.5 text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                  <p className="text-xs text-zinc-400 mt-2">Enter code sent to</p>
                  <p className="text-xs font-mono font-bold text-[#FF69B4]">{getFullPhoneNumber()}</p>
                </div>

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full bg-[#14141A] border-2 border-zinc-700 focus:border-[#FF69B4] rounded-xl py-2.5 text-center text-lg font-mono tracking-[0.4em] text-white focus:outline-none"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || otpCode.length !== 6}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#E0559E] hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,105,180,0.4)] disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{mode === 'login' ? 'Verify OTP & Sign In' : 'Verify OTP & Create Account'}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setPhoneStep('enter_phone')}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    Change number
                  </button>

                  <div>
                    {countdown > 0 ? (
                      <span className="text-zinc-500 font-mono text-[11px]">Resend in {countdown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-[#FF69B4] hover:underline font-bold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Resend OTP</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </>
        )}

        {/* EMAIL FLOW */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Age (18+)</label>
                    <input
                      type="number"
                      min="18"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF69B4]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF69B4]"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirm18}
                      onChange={(e) => setConfirm18(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-[#FF69B4]"
                    />
                    <span className="text-[11px] text-zinc-300">
                      I confirm I am 18+ years old and agree to Guidelines.
                    </span>
                  </label>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-[#14141A] border border-zinc-800 rounded-xl px-3 pr-9 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#FF69B4]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#E0559E] hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,105,180,0.4)] disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Divider & Google */}
        {phoneStep === 'enter_phone' && (
          <>
            <div className="relative flex py-2.5 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-2 text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Or</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              className="w-full py-2 px-3 rounded-xl bg-[#14141A] hover:bg-[#1A1A22] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-800 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Super Admin Access */}
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => { setShowAdminModal(true); setAdminPassword(''); setAdminError(null); }}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Super Admin Access</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Super Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-sm bg-[#141419] border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-4">
              <KeyRound className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-white">Super Admin Password</h3>
            </div>
            {adminError && (
              <p className="p-2 text-xs bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl mb-3">{adminError}</p>
            )}
            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showAdminPasswordText ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full bg-[#0B0B0E] border border-zinc-700 rounded-xl px-3 pr-9 py-2 text-xs text-white"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPasswordText(!showAdminPasswordText)}
                  className="absolute right-2.5 top-2 text-zinc-400"
                >
                  {showAdminPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={adminVerifying}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl"
              >
                {adminVerifying ? 'Verifying...' : 'Verify Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
