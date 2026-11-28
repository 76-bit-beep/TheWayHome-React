export const seoConfig = {
  siteName: 'The Way Home',
  productionUrl: 'https://www.thewayhome.co.za',
  launchMode: 'live',

  getRobots(mode) {
    return mode === this.launchMode
      ? 'index, follow'
      : 'noindex, follow'
  },

  adminRobots: 'noindex, nofollow',
}