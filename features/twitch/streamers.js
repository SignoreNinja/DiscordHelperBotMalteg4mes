 // displayName der Name im Discord-Auswahlpanel.
const STREAMERS = [
  { login: 'misskowalski', displayName: 'MissKowalski' },
  { login: 'opphorx', displayName: 'Opphil' },
  { login: 'wuchitv', displayName: 'WuchiTV' },
  { login: 'ronjawolf2007', displayName: 'RonjaWolf2007' },
  { login: 'moorrisss', displayName: 'Moorrisss' },
  { login: 'chronoyaksha', displayName: 'Chronoyaksha' },
  { login: 'flammengott', displayName: 'Flammengott' },
  { login: 'bagontr01', displayName: 'BagonTr01' },
  { login: 'codewizardtv', displayName: 'CodeWizardTV' },
  { login: 'derliber', displayName: 'Derliber' },
  { login: 'fynnow', displayName: 'Fynnow' },
  { login: 'kaledoss', displayName: 'Kaledoss' },
  { login: 'muecke0702', displayName: 'Muecke0702' },
  { login: 'roggberd', displayName: 'Roggberd' },
  { login: 'scusytv', displayName: 'ScusyTV' },
  { login: 'xxlukaas_', displayName: 'XxLukas' },
  { login: 'ccatched', displayName: 'ccatched' },
  { login: 'simontheking799', displayName: 'Simontheking799' },
  { login: 'tsheyn', displayName: 'Tsheyn' },
  { login: 'champion336666', displayName: 'Champion336666' },
  { login: 'Gemboss01', displayName: 'dani_derallerechte' },
  { login: 'Sonata', displayName: 'sonata_1998' },
  { login: 'dfd1_dragoon', displayName: 'dfd1_dragoon' }
].map(streamer => ({
  ...streamer,
  login: streamer.login.toLowerCase(),
  roleName: `Stream-Ping: ${streamer.displayName}`
}));

module.exports = { STREAMERS };

