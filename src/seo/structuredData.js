export const lodgingSchema = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: 'The Way Home',
  description:
    "Private self-catering cottage in Vredenburg on South Africa's West Coast, accommodating up to five guests.",
  telephone: '+27723756637',
  email: 'info@thewayhome.co.za',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '1 Ibis Street',
    addressLocality: 'Vredenburg',
    addressRegion: 'Western Cape',
    postalCode: '7380',
    addressCountry: 'ZA',
  },
  amenityFeature: [
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Wi-Fi',
      value: true,
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Off-street parking',
      value: true,
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Self-catering kitchen',
      value: true,
    },
    {
      '@type': 'LocationFeatureSpecification',
      name: 'Private entrance',
      value: true,
    },
  ],
  containsPlace: {
    '@type': 'Accommodation',
    name: 'The Cottage',
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: 5,
    },
  },
}