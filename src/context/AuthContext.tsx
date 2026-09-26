import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  deleteUser,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  increment,
  getDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { SupportedLanguage } from '../utils/i18n';
import { seedFirestoreDatabase } from '../firebase/seed';
import { getDefaultFemaleAvatar } from '../services/staticCdnService';
import { requestNotificationPermissionAndSaveToken, initFCM } from '../services/fcmService';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: {
    email: string;
    pass: string;
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    location: string;
    bio?: string;
    interests?: string[];
    role?: UserRole;
  }) => Promise<void>;
  sendPhoneOtp: (phoneNumber: string, containerId?: string) => Promise<ConfirmationResult>;
  verifyPhoneLogin: (confirmationResult: ConfirmationResult, otp: string, phoneNumber: string) => Promise<void>;
  verifyPhoneRegister: (
    confirmationResult: ConfirmationResult,
    otp: string,
    data: {
      phone: string;
      name: string;
      age: number;
      gender: 'male' | 'female' | 'other';
      location: string;
      bio?: string;
      interests?: string[];
      role?: UserRole;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserLanguage: (lang: SupportedLanguage) => Promise<void>;
  updateCoins: (delta: number) => Promise<void>;
  updateDiamonds: (delta: number) => Promise<void>;
  deleteMyAccount: () => Promise<void>;
  demoLoginAsUser: () => Promise<void>;
  demoLoginAsAdmin: () => Promise<void>;
  loginAsSuperAdmin: (password: string) => Promise<void>;
  requestPushPermission: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const requestedFcmRef = useRef<string | null>(null);

  // Requirement 1: Request notification permission on login and save FCM token to Firestore
  useEffect(() => {
    if (currentUser?.uid && requestedFcmRef.current !== currentUser.uid) {
      requestedFcmRef.current = currentUser.uid;
      // Initialize FCM service worker and request notification permission
      requestNotificationPermissionAndSaveToken(currentUser.uid).then((res) => {
        if (res.token) {
          console.log('[FCM] Push token registered for active user:', currentUser.name);
        }
      }).catch((err) => {
        console.warn('[FCM] Notification permission request error:', err);
      });
    }
  }, [currentUser?.uid]);

  const requestPushPermission = async () => {
    if (!currentUser?.uid) return;
    await requestNotificationPermissionAndSaveToken(currentUser.uid);
  };

  // Bind real-time snapshot to user document in Firestore
  const bindUserDoc = (uid: string) => {
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }

    const userDocRef = doc(db, 'users', uid);
    unsubscribeSnapshotRef.current = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as UserProfile;
        // Real customer without uploaded photo: ensure cute female avatar illustration
        if (data.role === 'user' && (!data.profile_pic || data.profile_pic.includes('bottts') || data.profile_pic.includes('seed=user'))) {
          const femaleAvatar = getDefaultFemaleAvatar(uid);
          data.profile_pic = femaleAvatar;
          updateDoc(userDocRef, { profile_pic: femaleAvatar }).catch(() => {});
        }
        setCurrentUser(data);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Firestore user snapshot error:', err);
      setLoading(false);
    });
  };

  // Auto run seeding on first mount
  useEffect(() => {
    seedFirestoreDatabase().catch(console.error);
  }, []);

  // Listen to Firebase Auth state with fallback to local session
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (fUser) {
        localStorage.removeItem('meetup_active_user_uid');
        const userDocRef = doc(db, 'users', fUser.uid);
        
        // Ensure doc exists in Firestore
        try {
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            const fallbackEmail = fUser.email || (fUser.phoneNumber ? `${fUser.phoneNumber.replace(/[^0-9]/g, '')}@meetup.user` : '');
            const newProfile: UserProfile = {
              uid: fUser.uid,
              name: fUser.displayName || (fUser.phoneNumber ? `User ${fUser.phoneNumber.slice(-4)}` : fUser.email?.split('@')[0] || 'Member'),
              email: fallbackEmail,
              phone_number: fUser.phoneNumber || undefined,
              age: 22,
              gender: 'other',
              location: 'Chennai, Tamil Nadu',
              bio: 'Hey there! Exploring Meet Up.',
              profile_pic: fUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fUser.uid}`,
              interests: ['Music', 'Dating', 'Conversations'],
              language: 'en',
              role: fUser.email === 'admin@meetup.com' ? 'admin' : 'user',
              coins_balance: fUser.email === 'admin@meetup.com' ? 9999 : 50,
              diamonds_balance: 0,
              voice_rate: 20,
              video_rate: 50,
              status: 'online',
              is_blocked: false,
              isBlocked: false,
              created_at: serverTimestamp(),
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, newProfile);
          } else if (fUser.phoneNumber && !snap.data().phone_number) {
            await updateDoc(userDocRef, { phone_number: fUser.phoneNumber });
          }
        } catch (e) {
          console.warn('Error reading/writing user doc on auth change:', e);
        }

        bindUserDoc(fUser.uid);
      } else {
        // If not in Firebase Auth, check if there is an active local demo / fallback user
        const savedLocalUid = localStorage.getItem('meetup_active_user_uid');
        if (savedLocalUid) {
          bindUserDoc(savedLocalUid);
        } else {
          if (unsubscribeSnapshotRef.current) {
            unsubscribeSnapshotRef.current();
            unsubscribeSnapshotRef.current = null;
          }
          setCurrentUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  // Google Sign In (Supported directly by Firebase in AI Studio)
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();

    // Check if it's admin credentials
    if (trimmedEmail === 'admin@meetup.com' && pass === 'admin123') {
      await demoLoginAsAdmin();
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, pass);
    } catch (err: any) {
      // If Email/Password auth is disabled in Firebase console (operation-not-allowed)
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        const localUid = `user_${btoa(trimmedEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
        const userDocRef = doc(db, 'users', localUid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          localStorage.setItem('meetup_active_user_uid', localUid);
          bindUserDoc(localUid);
          return;
        } else {
          // Create user profile in Firestore
          const newProfile: UserProfile = {
            uid: localUid,
            name: trimmedEmail.split('@')[0],
            email: trimmedEmail,
            age: 23,
            gender: 'other',
            location: 'Chennai, Tamil Nadu',
            bio: 'Hey there! Exploring Meet Up.',
            profile_pic: getDefaultFemaleAvatar(localUid),
            interests: ['Conversations', 'Music'],
            language: 'en',
            role: 'user',
            coins_balance: 50,
            diamonds_balance: 0,
            voice_rate: 20,
            video_rate: 50,
            status: 'online',
            is_blocked: false,
            isBlocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          };
          await setDoc(userDocRef, newProfile);
          localStorage.setItem('meetup_active_user_uid', localUid);
          bindUserDoc(localUid);
          return;
        }
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    pass: string;
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    location: string;
    bio?: string;
    interests?: string[];
    role?: UserRole;
  }) => {
    setLoading(true);
    const trimmedEmail = data.email.trim().toLowerCase();

    try {
      const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, data.pass);
      const uid = userCred.user.uid;
      const targetRole: UserRole = data.role || (trimmedEmail === 'admin@meetup.com' ? 'admin' : 'user');
      
      const newProfile: UserProfile = {
        uid,
        name: data.name.trim(),
        email: trimmedEmail,
        age: Number(data.age),
        gender: data.gender,
        location: data.location.trim() || 'Tamil Nadu, India',
        bio: data.bio?.trim() || (targetRole === 'listener' ? 'Empathetic listener ready for friendly audio & video chats.' : 'Hi! Looking to connect and meet amazing listeners.'),
        // Real customer without uploaded photo -> Cute female avatar illustration
        profile_pic: getDefaultFemaleAvatar(uid),
        interests: data.interests && data.interests.length > 0 ? data.interests : ['Dating', 'Friendly Chats', 'Music'],
        language: 'en',
        role: targetRole,
        coins_balance: targetRole === 'listener' ? 0 : 50,
        diamonds_balance: 0,
        voice_rate: 20,
        video_rate: 50,
        audio_rate_coins: 20,
        video_rate_coins: 50,
        status: 'online',
        is_blocked: false,
        isBlocked: false,
        created_at: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', uid), newProfile);
    } catch (err: any) {
      // If Email/Password auth is disabled in Firebase console (operation-not-allowed)
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        const localUid = `user_${btoa(trimmedEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
        const targetRole: UserRole = data.role || (trimmedEmail === 'admin@meetup.com' ? 'admin' : 'user');
        const newProfile: UserProfile = {
          uid: localUid,
          name: data.name.trim(),
          email: trimmedEmail,
          age: Number(data.age),
          gender: data.gender,
          location: data.location.trim() || 'Tamil Nadu, India',
          bio: data.bio?.trim() || (targetRole === 'listener' ? 'Empathetic listener ready for friendly audio & video chats.' : 'Hi! Looking to connect and meet amazing listeners.'),
          profile_pic: getDefaultFemaleAvatar(localUid),
          interests: data.interests && data.interests.length > 0 ? data.interests : ['Dating', 'Friendly Chats', 'Music'],
          language: 'en',
          role: targetRole,
          coins_balance: targetRole === 'listener' ? 0 : 50,
          diamonds_balance: 0,
          voice_rate: 20,
          video_rate: 50,
          audio_rate_coins: 20,
          video_rate_coins: 50,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', localUid), newProfile);
        localStorage.setItem('meetup_active_user_uid', localUid);
        bindUserDoc(localUid);
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, containerId: string = 'recaptcha-container'): Promise<ConfirmationResult> => {
    const cleaned = phoneNumber.trim().replace(/[\s\-()]/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 8) {
      throw new Error('Please enter a valid phone number with country code (e.g. +91 9876543210)');
    }

    // Ensure container element exists in DOM
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }

    // Use already initialized verifier from component mount if available
    let verifier = (window as any).recaptchaVerifier;

    if (!verifier) {
      // Check if window.recaptchaVerifier exists, if yes clear it
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing existing recaptchaVerifier:', e);
        }
        (window as any).recaptchaVerifier = null;
      }

      // Clear existing DOM container before creating new one
      container.innerHTML = '';

      // Initialize invisible reCAPTCHA
      verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          console.warn('reCAPTCHA expired');
          if ((window as any).recaptchaVerifier) {
            try {
              (window as any).recaptchaVerifier.clear();
            } catch (e) {}
            (window as any).recaptchaVerifier = null;
          }
        }
      });

      // Render only once
      try {
        await verifier.render();
      } catch (renderErr) {
        console.warn('reCAPTCHA render warning in sendPhoneOtp:', renderErr);
      }

      (window as any).recaptchaVerifier = verifier;
    }

    try {
      const confirmationResult = await signInWithPhoneNumber(auth, cleaned, verifier);
      return confirmationResult;
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err);
      // Clean up verifier on error so subsequent requests can re-initialize safely
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
      if (container) {
        container.innerHTML = '';
      }

      // If Phone Auth is disabled or restricted in Firebase console (operation-not-allowed)
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        console.warn('Phone auth not enabled in Firebase Console. Providing test verification mode (code: 123456).');
        const mockConfirmationResult: ConfirmationResult = {
          verificationId: `test_verif_${Date.now()}`,
          confirm: async (code: string) => {
            const trimmed = code.trim();
            if (trimmed === '123456' || trimmed === '000000') {
              const testUid = `phone_${cleaned.replace(/[^0-9]/g, '')}`;
              localStorage.setItem('meetup_active_user_uid', testUid);
              return {
                user: {
                  uid: testUid,
                  displayName: `Member ${cleaned.slice(-4)}`,
                  phoneNumber: cleaned,
                  email: `${cleaned.replace(/[^0-9]/g, '')}@meetup.user`,
                } as any,
                providerId: 'phone',
                operationType: 'signIn',
              } as any;
            }
            const invalidErr: any = new Error('Invalid verification code. Please check the code or use test code 123456.');
            invalidErr.code = 'auth/invalid-verification-code';
            throw invalidErr;
          }
        };
        return mockConfirmationResult;
      }
      throw err;
    }
  };

  const verifyPhoneLogin = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    phoneNumber: string
  ) => {
    setLoading(true);
    const cleanedOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanedOtp || cleanedOtp.length < 6) {
      setLoading(false);
      throw new Error('Please enter a valid 6-digit OTP code.');
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanedOtp);
      const fUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', fUser.uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newProfile: UserProfile = {
          uid: fUser.uid,
          name: fUser.displayName || `User ${phoneNumber.slice(-4)}`,
          email: fUser.email || `${phoneNumber.replace(/[^0-9]/g, '')}@meetup.user`,
          phone_number: phoneNumber,
          age: 22,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: 'Hey there! Exploring Meet Up.',
          profile_pic: getDefaultFemaleAvatar(fUser.uid),
          interests: ['Music', 'Dating', 'Conversations'],
          language: 'en',
          role: 'user',
          coins_balance: 50,
          diamonds_balance: 0,
          voice_rate: 20,
          video_rate: 50,
          status: 'online',
          is_blocked: false,
          created_at: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
      } else {
        await updateDoc(userDocRef, {
          status: 'online',
          phone_number: phoneNumber,
        });
      }

      localStorage.setItem('meetup_active_user_uid', fUser.uid);
      bindUserDoc(fUser.uid);
    } catch (err: any) {
      console.error('OTP confirmation error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP and try again.');
      }
      if (err.code === 'auth/code-expired') {
        throw new Error('Verification code has expired. Please click "Resend OTP" to receive a new code.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneRegister = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    data: {
      phone: string;
      name: string;
      age: number;
      gender: 'male' | 'female' | 'other';
      location: string;
      bio?: string;
      interests?: string[];
      role?: UserRole;
    }
  ) => {
    setLoading(true);
    const cleanedOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanedOtp || cleanedOtp.length < 6) {
      setLoading(false);
      throw new Error('Please enter a valid 6-digit OTP code.');
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanedOtp);
      const fUser = userCredential.user;
      const targetRole: UserRole = data.role || 'user';
      
      const newProfile: UserProfile = {
        uid: fUser.uid,
        name: data.name.trim(),
        email: `${data.phone.replace(/[^0-9]/g, '')}@meetup.user`,
        phone_number: data.phone,
        age: Number(data.age),
        gender: data.gender,
        location: data.location.trim() || 'Tamil Nadu, India',
        bio: data.bio?.trim() || (targetRole === 'listener' ? 'Empathetic listener ready for friendly audio & video chats.' : 'Hi! Looking to connect and meet amazing listeners.'),
        profile_pic: getDefaultFemaleAvatar(fUser.uid),
        interests: data.interests && data.interests.length > 0 ? data.interests : ['Dating', 'Friendly Chats', 'Music'],
        language: 'en',
        role: targetRole,
        coins_balance: targetRole === 'listener' ? 0 : 50,
        diamonds_balance: 0,
        voice_rate: 20,
        video_rate: 50,
        audio_rate_coins: 20,
        video_rate_coins: 50,
        status: 'online',
        is_blocked: false,
        isBlocked: false,
        created_at: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', fUser.uid), newProfile);
      localStorage.setItem('meetup_active_user_uid', fUser.uid);
      bindUserDoc(fUser.uid);
    } catch (err: any) {
      console.error('OTP registration error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP and try again.');
      }
      if (err.code === 'auth/code-expired') {
        throw new Error('Verification code has expired. Please click "Resend OTP" to receive a new code.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const demoLoginAsUser = async () => {
    setLoading(true);
    const demoEmail = 'demo.user@meetup.com';
    const demoPass = 'meetup123';

    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: 'Karthik Raja',
          email: demoEmail,
          age: 24,
          gender: 'male',
          location: 'Chennai, Tamil Nadu',
          bio: 'Tech professional exploring conversations & friendly connections.',
          profile_pic: 'https://randomuser.me/api/portraits/men/32.jpg',
          interests: ['Movies', 'Coffee', 'Music'],
          language: 'en',
          role: 'user',
          coins_balance: 150,
          diamonds_balance: 0,
          voice_rate: 20,
          video_rate: 50,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // Operation not allowed or credentials failed in Firebase Auth:
        // Gracefully persist & activate demo user in Firestore directly!
        const demoUid = 'demo_user_karthik_raja';
        const userDocRef = doc(db, 'users', demoUid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          await setDoc(userDocRef, {
            uid: demoUid,
            name: 'Karthik Raja',
            email: demoEmail,
            age: 24,
            gender: 'male',
            location: 'Chennai, Tamil Nadu',
            bio: 'Tech professional exploring conversations & friendly connections.',
            profile_pic: 'https://randomuser.me/api/portraits/men/32.jpg',
            interests: ['Movies', 'Coffee', 'Music'],
            language: 'en',
            role: 'user',
            coins_balance: 150,
            diamonds_balance: 0,
            voice_rate: 20,
            video_rate: 50,
            status: 'online',
            is_blocked: false,
            isBlocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
        localStorage.setItem('meetup_active_user_uid', demoUid);
        bindUserDoc(demoUid);
      }
    } finally {
      setLoading(false);
    }
  };

  const demoLoginAsAdmin = async () => {
    setLoading(true);
    const adminEmail = 'admin@meetup.com';
    const adminPass = 'admin123';

    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: 'Meet Up Admin',
          email: adminEmail,
          age: 30,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: 'Meet Up Platform Super Administrator',
          profile_pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces',
          interests: ['Safety', 'Moderation'],
          language: 'en',
          role: 'admin',
          coins_balance: 9999,
          diamonds_balance: 500,
          voice_rate: 20,
          video_rate: 50,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // Operation not allowed or credentials failed in Firebase Auth:
        // Gracefully persist & activate super admin in Firestore directly!
        const adminUid = 'admin_meetup_super';
        const adminDocRef = doc(db, 'users', adminUid);
        const snap = await getDoc(adminDocRef);
        if (!snap.exists()) {
          await setDoc(adminDocRef, {
            uid: adminUid,
            name: 'Meet Up Admin',
            email: adminEmail,
            age: 30,
            gender: 'other',
            location: 'Chennai, Tamil Nadu',
            bio: 'Meet Up Platform Super Administrator',
            profile_pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces',
            interests: ['Safety', 'Moderation'],
            language: 'en',
            role: 'admin',
            coins_balance: 9999,
            diamonds_balance: 500,
            voice_rate: 20,
            video_rate: 50,
            status: 'online',
            is_blocked: false,
            isBlocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
        localStorage.setItem('meetup_active_user_uid', adminUid);
        bindUserDoc(adminUid);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginAsSuperAdmin = async (securityPassword: string) => {
    if (securityPassword !== 'Raja@2026') {
      throw new Error('Access Denied: Incorrect Super Admin Password.');
    }
    await demoLoginAsAdmin();
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' });
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('meetup_active_user_uid');
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }
    try {
      await signOut(auth);
    } catch {}
    setCurrentUser(null);
  };

  const updateUserLanguage = async (lang: SupportedLanguage) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { language: lang.toLowerCase() });
      setCurrentUser(prev => prev ? { ...prev, language: lang.toLowerCase() } : null);
    } catch (e) {
      console.error('Failed to update language', e);
    }
  };

  const updateCoins = async (delta: number) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      coins_balance: increment(delta)
    });
  };

  const updateDiamonds = async (delta: number) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      diamonds_balance: increment(delta)
    });
  };

  const deleteMyAccount = async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    // Hard delete user doc from Firestore
    await deleteDoc(doc(db, 'users', uid));
    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch {}
    }
    localStorage.removeItem('meetup_active_user_uid');
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        login,
        loginWithGoogle,
        register,
        sendPhoneOtp,
        verifyPhoneLogin,
        verifyPhoneRegister,
        logout,
        updateUserLanguage,
        updateCoins,
        updateDiamonds,
        deleteMyAccount,
        demoLoginAsUser,
        demoLoginAsAdmin,
        loginAsSuperAdmin,
        requestPushPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
