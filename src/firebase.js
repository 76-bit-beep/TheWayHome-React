
import {initializeApp} from 'firebase/app'
import {getAuth} from 'firebase/auth'
import {getFirestore} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCv5XkOmgU4JVFFqKrvNcv1-JEV-3AUoFY',
  authDomain: 'thewayhome-f20bd.firebaseapp.com',
  projectId: 'thewayhome-f20bd',
  storageBucket: 'thewayhome-f20bd.firebasestorage.app',
  messagingSenderId: '516958158491',
  appId: '1:516958158491:web:7b611bae84e6654dd4d03e',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
