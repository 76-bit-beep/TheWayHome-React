import {
  getAuth,
  connectAuthEmulator
} from 'firebase/auth'

import {app} from './firebase.js'

export const auth = getAuth(app)

if (import.meta.env?.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true
  })
}
