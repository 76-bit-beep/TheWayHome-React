
import {useEffect, useState, lazy, Suspense} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {auth} from '../firebaseAuth.js'
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'))

const ADMIN_UID = 'qCMUIllRSgRmTucv7Tlqz5PJ3gl2'

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Check whether the administrator is already signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        if (currentUser?.uid === ADMIN_UID) {
          setUser(currentUser)
        } else {
          setUser(null)
        }

        setCheckingAuth(false)
      },
      () => {
        setUser(null)
        setCheckingAuth(false)
        setError('Unable to verify your login.')
      }
    )

    return () => unsubscribe()
  }, [])

  // Sign in using Firebase Authentication
  const handleLogin = async (event) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )

      // Only the registered administrator can enter
      if (result.user.uid !== ADMIN_UID) {
        await signOut(auth)
        setError('Administrator access required.')
        return
      }

      setUser(result.user)
      setPassword('')
    } catch {
      setError('Unable to sign in. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Check existing Firebase session
  if (checkingAuth) {
    return (
      <main style={{
        maxWidth:'420px',
        margin:'80px auto',
        padding:'30px',
        textAlign:'center',
        fontFamily:'Arial, sans-serif'
      }}>
        <h2>The Way Home</h2>
        <p>Checking administrator access...</p>
      </main>
    )
  }

  // Show dashboard when authenticated
  if (user) {
    return (
      <Suspense fallback={
        <main role="status" style={{
          maxWidth: '420px',
          margin: '80px auto',
          padding: '30px',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2>The Way Home</h2>
          <p>Loading administrator dashboard...</p>
        </main>
      }>
        <AdminDashboard />
      </Suspense>
    )
  }

  // Administrator login screen
  return (
    <main style={{
      maxWidth:'420px',
      margin:'80px auto',
      padding:'30px',
      fontFamily:'Arial, sans-serif'
    }}>
      <h1 style={{
        color:'#082f6d',
        marginBottom:'12px'
      }}>
        The Way Home
      </h1>

      <h2 style={{
        color:'#082f6d',
        marginBottom:'28px'
      }}>
        Administrator Login
      </h2>

      <form onSubmit={handleLogin}>
        <label htmlFor="admin-email">
          Email
        </label>

        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          style={{
            width:'100%',
            boxSizing:'border-box',
            padding:'12px',
            marginTop:'6px',
            marginBottom:'20px',
            borderRadius:'6px',
            border:'1px solid #aaa'
          }}
        />

        <label htmlFor="admin-password">
          Password
        </label>

        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          style={{
            width:'100%',
            boxSizing:'border-box',
            padding:'12px',
            marginTop:'6px',
            marginBottom:'24px',
            borderRadius:'6px',
            border:'1px solid #aaa'
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width:'100%',
            padding:'13px',
            background:'#082f6d',
            color:'#fff',
            border:'none',
            borderRadius:'8px',
            fontSize:'16px',
            fontWeight:'bold',
            cursor:loading ? 'wait' : 'pointer',
            opacity:loading ? 0.7 : 1
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          style={{
            color:'#b00020',
            marginTop:'18px'
          }}
        >
          {error}
        </p>
      )}

      <p style={{
        marginTop:'28px',
        textAlign:'center',
        color:'#666',
        fontSize:'13px'
      }}>
        Authorised personnel only
      </p>
    </main>
  )
}

export default AdminLogin
