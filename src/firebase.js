
import {initializeApp} from 'firebase/app'
import {
  getFirestore,
  connectFirestoreEmulator
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCv5XkOmgU4JVFFqKrvNcv1-JEV-3AUoFY',
  authDomain: 'thewayhome-f20bd.firebaseapp.com',
  projectId: 'thewayhome-f20bd',
  storageBucket: 'thewayhome-f20bd.firebasestorage.app',
  messagingSenderId: '516958158491',
  appId: '1:516958158491:web:7b611bae84e6654dd4d03e'
}

const isNodeTest =
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  process.env.THEWAYHOME_TEST === '1'

if (typeof window === 'undefined' && !isNodeTest) {
  throw new Error('Firebase initialization outside browser requires test mode')
}

export const app = initializeApp(
  isNodeTest
    ? {
        projectId: 'demo-thewayhome',
        apiKey: 'test-api-key',
        appId: 'test-app-id'
      }
    : firebaseConfig
)

export const db = getFirestore(app)

// Connect to local Firebase emulators during Vite development.
// Production builds continue using the real Firebase services.
if (isNodeTest) {
  connectFirestoreEmulator(db, '127.0.0.1', 8081)
} else if (import.meta.env?.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)

  console.info('Firebase LOCAL EMULATORS connected')
}
