
import { useState } from 'react'
import BookingModal from './components/BookingModal'
import './App.css'

// Cottage photographs
const photos = [
  '/images/cottage/cottage_slide_01.jpg',
  '/images/cottage/cottage_slide_02.jpg',
  '/images/cottage/cottage_slide_04.jpg'
]

// Property location
const address =
  '1 Ibis Street, Vredenburg, 7380, South Africa'

const mapsUrl =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent(address)

// Welcome section features
const features = [
  ['▰', 'Self-catering cottage'],
  ['◉', 'Wi-Fi'],
  ['▣', 'Off-street parking'],
  ['♜', 'Fully equipped'],
  ['▤', 'Linen & towels included']
]

// Homepage calendar preview
function CalendarPreview() {
  const [monthOffset, setMonthOffset] = useState(0)

  const today = new Date()

  const first = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1
  )

  const count = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0
  ).getDate()

  const blank = (first.getDay() + 6) % 7

  const cells = [
    ...Array(blank).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => i + 1
    )
  ]

  return (
    <div className="calendar-wrap">
      <div className="calendar-head">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setMonthOffset(x => Math.max(0, x - 1))
          }
        >
          ❮
        </button>

        <strong>
          {first.toLocaleString('en-ZA', {
            month: 'long',
            year: 'numeric'
          })}
        </strong>

        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setMonthOffset(x => x + 1)
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
          'Sun'
        ].map(day => (
          <b key={day}>{day}</b>
        ))}

        {cells.map((day, index) => (
          <span
            className={
              day
                ? 'calendar-day'
                : 'calendar-empty'
            }
            key={index}
          >
            {day}
          </span>
        ))}
      </div>

      <p className="calendar-disclaimer">
        Calendar preview only — live availability
        coming soon.
      </p>
    </div>
  )
}

// Main website
function App() {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  // Controls the booking pop-up
  const [bookingOpen, setBookingOpen] = useState(false)

  function changePhoto(direction) {
    setPhotoIndex(
      current =>
        (current + direction + photos.length) %
        photos.length
    )
  }

  return (
    <div className="site" id="home">

      {/* HEADER */}

      <header className="site-header">
        <a
          className="brand"
          href="#home"
          aria-label="The Way Home homepage"
        >
          <span className="brand-leaf">❧</span>

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
          onClick={() => setMenuOpen(false)}
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
              src="/images/homepage/home_01.jpg"
              alt="The Way Home guest accommodation entrance"
            />
          </div>

          <div className="hero-copy" id="story">
            <h1>
              Your home away from home
              <br />
              on South Africa's West Coast
            </h1>

            <div className="ornament">
              ━━━━ ❧ ━━━━
            </div>

            <p>
              Located in Vredenburg, The Way Home is
              a family residence converted into a
              welcoming self-catering cottage with
              its own private entrance, off-street
              parking and everything you need for
              a comfortable stay.
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
                alt={`The Cottage interior photograph ${
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
                A separate double bedroom and a
                welcoming living area with a double
                bed, single bed and double sleeper
                couch. With its own private entrance.
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

            {/* BOOKING CALENDAR */}

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

        {/* FIGTREE CRAFT STALL */}

        <section
          className="figtree-banner"
          id="figtree"
        >
          <div
            className="fig-art"
            aria-hidden="true"
          >
            ❧
          </div>

          <h2>Figtree Craft Stall</h2>

          <p>
            A selection of handcrafted items,
            gifts and local treats. From home-grown
            goodness to unique, locally made crafts
            inspired by the West Coast.
          </p>

          <span className="shop-coming">
            Craft stall coming soon
          </span>
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
              We'd love to hear from you.
            </p>
          </div>

          <div className="contact-details">
            <p>
              <span>📍</span>
              <strong>The Way Home</strong>
              <br />
              {address}
            </p>

            <p>
              <span>☎</span>
              <a href="tel:+27227133134">
                +27 22 713 3134
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
              href="https://wa.me/27227133134"
              target="_blank"
              rel="noreferrer"
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
              rel="noreferrer"
            >
              ➤ &nbsp; Get Directions
            </a>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps ↗
            </a>
          </div>
        </section>

      </main>

      {/* FOOTER */}

      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} The Way Home ·
          Vredenburg, South Africa
        </span>
      </footer>

      {/* INDEPENDENT BOOKING POP-UP */}

      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />

    </div>
  )
}

export default App
