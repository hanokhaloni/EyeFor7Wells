// The seven wells. Six are real 7 Wells Indies channels. The seventh is ours.
export const WELLS = [
  { id:'whatsapp', n:1, name:'WHATSAPP', he:'וואטסאפ', role:'the daily chatter',
    url:'https://chat.whatsapp.com/DU2DApJcDDZIFhOYTUpZhT', hue:'water', depth:12 },
  { id:'discord',  n:2, name:'DISCORD',  he:'דיסקורד', role:'the voice channel',
    url:'https://discord.gg/PVbek2WN', hue:'water', depth:30 },
  { id:'meetup',   n:3, name:'MEETUP',   he:'מיטאפ',  role:'the southern game programming meetup',
    url:'https://www.meetup.com/the-southern-game-programming-meetup-group/', hue:'sand', depth:21 },
  { id:'youtube',  n:4, name:'YOUTUBE',  he:'יוטיוב',  role:'talks, recorded',
    url:'https://www.youtube.com/channel/UCCHR_ulaDIIODgsqyg4o5DA', hue:'rust', depth:44 },
  { id:'instagram',n:5, name:'INSTAGRAM',he:'אינסטגרם',role:'what it looks like',
    url:'https://www.instagram.com/7wellsindies', hue:'sand', depth:9 },
  { id:'facebook', n:6, name:'FACEBOOK', he:'פייסבוק', role:'the deepest well',
    url:'https://www.facebook.com/7WellsIndies/', hue:'rust', depth:70 },
  { id:'seventh',  n:7, name:'',         he:'',        role:'dry',
    url:null, hue:'bone', depth:null },
];
export const byId = (id) => WELLS.find((w) => w.id === id);
