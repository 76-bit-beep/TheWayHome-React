
const {initializeApp,deleteApp} = require('firebase/app')

const {
  getFirestore,
  connectFirestoreEmulator
} = require('firebase/firestore')

const createEmulatorDatabase = () => {
  const app = initializeApp({
    projectId:'thewayhome-f20bd',
    apiKey:'test-api-key',
    appId:'test-app-id'
  },'booking-emulator-test')

  const db = getFirestore(app)

  connectFirestoreEmulator(db,'127.0.0.1',8080)

  return {
    db,
    cleanup:async () => {
      await deleteApp(app)
    }
  }
}

module.exports = {createEmulatorDatabase}
