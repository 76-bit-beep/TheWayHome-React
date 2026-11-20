
import {initializeApp} from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator
} from 'firebase/auth'
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

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

// Connect to local Firebase emulators during Vite development.
// Production builds continue using the real Firebase services.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings:true
  })

  connectFirestoreEmulator(db, '127.0.0.1', 8080)

  console.info('Firebase LOCAL EMULATORS connected')
}
