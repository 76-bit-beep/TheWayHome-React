import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase.js'
import BookingModal from './components/BookingModal'
import './App.css'

// GitHub Pages compatible image paths
const base = import.meta.env.BASE_URL


const photos = [
  `${base}images/cottage/cottage_bedroom.jpg`,
  `${base}images/cottage/cottage_kitchen.jpg`,
  `${base}images/cottage/cottage_sleeping.jpg`,
  `${base}images/cottage/cottage_bathroom.jpg`,
]


// Property details
const address = '1 Ibis Street, Vredenburg, 7380, South Africa'

const phoneDisplay = '+27 72 375 6637'
const phoneLink = '+27723756637'
const whatsappLink = 'https://wa.me/27723756637'

const mapsUrl =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(address)

const features = [
  ['▰', 'Self-catering cottage'],
  ['◉', 'Wi-Fi'],
  ['▣', 'Off-street parking'],
  ['♜', 'Fully equipped'],
  ['▤', 'Linen & towels included'],
]

// Homepage live availability calendar
function CalendarPreview() {
  const [monthOffset, setMonthOffset] = useState(0)
  const [bookedDates, setBookedDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Listen for live availability changes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'publicAvailability'),
      { includeMetadataChanges: true },
      snapshot => {
        const unavailable = new Set()

        snapshot.forEach(document => {
          unavailable.add(document.id)
        })

        setBookedDates(unavailable)
        setLoading(false)
        setError(snapshot.metadata.fromCache)
      },
      err => {
        console.error('Availability error:', err)
        setError(true)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Generate local date keys without UTC conversion
  function dateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const first = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1
  )

  const daysInMonth = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0
  ).getDate()

  const blankDays = (first.getDay() + 6) % 7

  const cells = [
    ...Array(blankDays).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => index + 1
    ),
  ]

  return (
    <div className="calendar-wrap">
      <div className="calendar-head">
        <button
          type="button"
          aria-label="Previous month"
          disabled={monthOffset === 0}
          onClick={() =>
            setMonthOffset(current =>
              Math.max(0, current - 1)
            )
          }
        >
          ❮
        </button>

        <strong>
          {first.toLocaleString('en-ZA', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>

        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setMonthOffset(current => current + 1)
          }
        >
          ❯
        </button>
      </div>

      <div className="calendar-grid">
        {[
          'Mon',
          'Tue',
          'Wed',
          'Thu',
          'Fri',
          'Sat',
          'Sun',
        ].map(day => (
          <b key={day}>{day}</b>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return (
              <span
                key={index}
                className="calendar-empty"
              />
            )
          }

          const date = new Date(
            first.getFullYear(),
            first.getMonth(),
            day
          )

          const key = dateKey(date)

          let status = 'available'

          if (date < today) {
            status = 'past'
          } else if (loading || error) {
            status = 'unknown'
          } else if (bookedDates.has(key)) {
            status = 'booked'
          }

          const labels = {
            available: 'Available',
            booked: 'Unavailable',
            past: 'Past date',
            unknown: 'Availability unknown',
          }

          return (
            <span
              key={index}
              className={`calendar-day calendar-${status}`}
              title={`${key}: ${labels[status]}`}
              aria-label={`${key}: ${labels[status]}`}
            >
              {day}
            </span>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <i className="legend-available" />
          Available
        </span>

        <span>
          <i className="legend-booked" />
          Unavailable
        </span>

        <span>
          <i className="legend-past" />
          Past
        </span>
      </div>

      <p
        className="calendar-disclaimer"
        aria-live="polite"
      >
        {loading
          ? 'Checking availability...'
          : error
            ? 'Live availability temporarily unavailable.'
            : 'Live availability — bookings subject to approval.'}
      </p>
    </div>
  )
}

// Main website
function App() {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)

  function changePhoto(direction) {
    setPhotoIndex(current =>
      (current + direction + photos.length) %
      photos.length
    )
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="site" id="home">

      {/* HEADER */}

      <header className="site-header">
        <a
          className="brand"
          href="#home"
          aria-label="The Way Home homepage"
          onClick={closeMenu}
        >
          <img
  className="brand-leaf"
  src={`${base}images/figtree/figtreelogo.png`}
  alt=""
/>

          <span>
            <strong>The Way Home</strong>
            <i className="brand-swish" />
          </span>
        </a>

        <div className="header-tagline">
          SELF-CATERING ACCOMMODATION
          <span>|</span>
          VREDENBURG · WEST COAST · SOUTH AFRICA
        </div>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() =>
            setMenuOpen(current => !current)
          }
        >
          ☰
        </button>

        <nav
          className={menuOpen ? 'open' : ''}
          aria-label="Main navigation"
          onClick={closeMenu}
        >
          <a className="active" href="#home">
            Home
          </a>

          <a href="#story">
            Our Story
          </a>

          <a href="#accommodation">
            Accommodation
          </a>

          <a href="#figtree">
            Figtree Craft Stall
          </a>

          <a href="#contact">
            Contact
          </a>
        </nav>
      </header>

      <main>

        {/* HERO SECTION */}

        <section
          className="hero"
          aria-label="Welcome to The Way Home"
        >
          <div className="hero-photo">
            <img
              src={`${base}images/homepage/home_01.jpg`}
              alt="The Way Home guest accommodation entrance"
            />
          </div>

          <div className="hero-copy" id="story">
            <h1>
              Your home away from home
              <br />
              on South Africa&apos;s West Coast
            </h1>

            <div className="ornament">
              ━━━━ ❧ ━━━━
            </div>

            <p>
              Located in Vredenburg, The Way Home
              is a family residence converted into
              a welcoming self-catering cottage
              with its own private entrance,
              off-street parking and everything
              you need for a comfortable stay.
            </p>

            <div className="hero-features">
              {features.map(([symbol, label]) => (
                <div key={label}>
                  <span aria-hidden="true">
                    {symbol}
                  </span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ACCOMMODATION SECTION */}

        <section
          className="accommodation-section"
          id="accommodation"
        >
          <div className="section-title">
            <h2>Our Accommodation</h2>

            <p>
              A comfortable self-catering cottage
              with everything you need for a
              relaxing stay.
            </p>
          </div>

          <article className="accommodation-card">

            {/* COTTAGE PHOTO GALLERY */}

            <div className="gallery">
              <img
                src={photos[photoIndex]}
                alt={`The Cottage photograph ${
                  photoIndex + 1
                } of ${photos.length}`}
              />

              <button
                type="button"
                className="gallery-prev"
                aria-label="Previous photo"
                onClick={() => changePhoto(-1)}
              >
                ❮
              </button>

              <button
                type="button"
                className="gallery-next"
                aria-label="Next photo"
                onClick={() => changePhoto(1)}
              >
                ❯
              </button>

              <div className="gallery-dots">
                {photos.map((photo, index) => (
                  <button
                    type="button"
                    key={photo}
                    className={
                      index === photoIndex
                        ? 'selected'
                        : ''
                    }
                    onClick={() =>
                      setPhotoIndex(index)
                    }
                    aria-label={`Show photo ${
                      index + 1
                    }`}
                    aria-pressed={
                      index === photoIndex
                    }
                  />
                ))}
              </div>
            </div>

            {/* COTTAGE DESCRIPTION */}

            <div className="cottage-info">
              <h3>The Cottage</h3>

              
            <p>
              Welcome to The Cottage, a comfortable self-catering
              retreat in Vredenburg on South Africa&apos;s beautiful
              West Coast.
            </p>

            <p>
              The Cottage features a separate double bedroom and
              an additional sleeping area with bunk beds and a
              single bed. Guests can enjoy a self-catering kitchen,
              Wi-Fi, off-street parking and a private entrance.
            </p>

            <p>
              Ideal for families or small groups looking for a
              relaxing home away from home.
            </p>


              <ul>
                <li>
                  <span>▰</span>
                  Sleeps up to 5
                </li>

                <li>
                  <span>◉</span>
                  Wi-Fi
                </li>

                <li>
                  <span>♜</span>
                  Self-catering kitchen
                </li>

                <li>
                  <span>▣</span>
                  Off-street parking
                </li>
              </ul>
            </div>

            {/* BOOKING SECTION */}
-- 
            <div className="booking-column">
              <CalendarPreview />

              <button
                type="button"
                className="booking-button"
                onClick={() =>
                  setBookingOpen(true)
                }
              >
                ▦ &nbsp; Request a Booking
              </button>
            </div>

          </article>
        </section>

       


        {/* CONTACT SECTION */}

        <section
          className="contact-section"
          id="contact"
        >
          <div className="contact-intro">
            <h2>Get in Touch</h2>

            <div className="ornament">
              ━━━━ ❧ ━━━━
            </div>

            <p>
              Have a question about staying with us?
              <br />
              We&apos;d love to hear from you.
            </p>
          </div>

          {/* CONTACT DETAILS */}

          <div className="contact-details">

            <p>
              <span>📍</span>
              <strong>The Way Home</strong>
              <br />
              {address}
            </p>

            <p>
              <span>☎</span>
              <a href={`tel:${phoneLink}`}>
                {phoneDisplay}
              </a>
            </p>

            <p>
              <span>✉</span>
              <a href="mailto:info@thewayhome.co.za">
                info@thewayhome.co.za
              </a>
            </p>

            <a
              className="whatsapp"
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat on WhatsApp
            </a>

          </div>

          {/* GOOGLE MAP */}

          <div className="map-area">
            <iframe
              title="Map of The Way Home in Vredenburg"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={
                'https://maps.google.com/maps?q=' +
                encodeURIComponent(address) +
                '&output=embed'
              }
            />
          </div>

          <div className="directions">
            <a
              className="directions-button"
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ➤ &nbsp; Get Directions
            </a>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps ↗
            </a>
          </div>
        </section>
{/* FIGTREE CRAFT STALL */}

<section
  className="figtree-image-banner"
  id="figtree"
>
  <a
    href="https://figtree-88f0e.web.app/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Visit the Figtree Craft Stall website"
    style={{display: 'block', cursor: 'pointer'}}
  >
    <img
    src={`${base}images/figtree/figtree-banner.png`}
    alt="Figtree Craft Stall - Handcrafted items, gifts and local treats"
    loading="lazy"
    className="figtree-banner-image"
  />
  </a>
</section>

      </main>

      {/* FOOTER */}

<footer className="site-footer">
  <span>
    © {new Date().getFullYear()} The Way Home ·
    Vredenburg, South Africa
  </span>

  <a
    className="admin-login-link"
    href={`${base}admin`}
  >
    Admin Login
  </a>
</footer>


      {/* BOOKING POP-UP */}

      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />

    </div>
  )
}

export default App
