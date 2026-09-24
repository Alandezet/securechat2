import type { Contact, Message } from './types'
const stamp = Date.now()
export const demoContacts: Contact[] = [
  { id: 'sofia', name: 'Sofia Chen', username: 'sofia.chen', avatar: '/images/sofia.jpg', color: 'sage', unread: 0, pinned: true, preview: 'You: I’ll bring the coffee ☕', time: '10:42 AM', timer: 86400 },
  { id: 'weekend', name: 'The weekend crew', username: 'weekend-crew', group: true, members: ['Sofia', 'You', 'Noah', 'Mia'], color: 'lavender', unread: 3, pinned: true, preview: 'Noah: Who’s bringing the coffee?', time: '10:38 AM' },
  { id: 'noah', name: 'Noah Williams', username: 'noah.w', color: 'peach', unread: 1, preview: 'Sent you the files. Take a look!', time: '10:24 AM' },
  { id: 'mia', name: 'Mia Patel', username: 'mia.p', avatar: '/images/mia.jpg', color: 'pink', unread: 0, preview: 'You: Thanks, you’re the best!', time: 'Yesterday' },
  { id: 'design', name: 'Design collective', username: 'design-collective', group: true, members: ['You', 'Mia', 'Oliver'], color: 'blue', unread: 0, preview: 'Mia: Love this direction ✨', time: 'Yesterday', muted: true },
  { id: 'oliver', name: 'Oliver James', username: 'oliver.j', color: 'sand', unread: 0, preview: 'See you on the other side.', time: 'Tuesday' },
  { id: 'emma', name: 'Emma Wilson', username: 'emma.w', color: 'sage', unread: 0, preview: 'This is our little corner of the internet.', time: 'Monday' },
]
export const demoMessages: Message[] = [
  { id: 's1', chatId: 'sofia', mine: false, type: 'text', text: 'Hey! Ready to trade our screens for some fresh air this weekend? 🌿', time: '10:32 AM', timestamp: stamp - 600000 },
  { id: 's2', chatId: 'sofia', mine: true, type: 'text', text: 'Absolutely. A little less scrolling, a little more exploring.', time: '10:34 AM', timestamp: stamp - 480000, status: 'local' },
  { id: 's3', chatId: 'sofia', mine: false, type: 'image', text: 'Found our spot. Just us, the mountains, and absolutely no notifications.', data: '/images/alpine-lake.jpg', name: 'A little escape.jpg', size: 34400, time: '10:36 AM', timestamp: stamp - 360000 },
  { id: 's5', chatId: 'sofia', mine: true, type: 'text', text: 'That sounds like the perfect plan. I’ll bring the coffee ☕', time: '10:42 AM', timestamp: stamp, status: 'local' },
  { id: 'w1', chatId: 'weekend', mine: false, type: 'text', text: 'Noah: Who’s bringing the coffee? I’ve got the snacks covered.', time: '10:38 AM', timestamp: stamp - 240000 },
  { id: 'n1', chatId: 'noah', mine: false, type: 'text', text: 'Sent you the files. Take a look! The route is about 8 km, with a lake halfway through.', time: '10:24 AM', timestamp: stamp - 1080000 },
  { id: 'm1', chatId: 'mia', mine: false, type: 'text', text: 'Just sent you my favorite places to stop along the way. Have an amazing trip!', time: 'Yesterday', timestamp: stamp - 86400000 },
  { id: 'm2', chatId: 'mia', mine: true, type: 'text', text: 'Thanks, you’re the best!', time: 'Yesterday', timestamp: stamp - 86200000, status: 'local' },
  { id: 'd1', chatId: 'design', mine: false, type: 'text', text: 'Mia: Love this direction ✨ Let’s keep it simple, thoughtful, and human.', time: 'Yesterday', timestamp: stamp - 86400000 },
  { id: 'o1', chatId: 'oliver', mine: false, type: 'text', text: 'See you on the other side.', time: 'Tuesday', timestamp: stamp - 172800000 },
  { id: 'e1', chatId: 'emma', mine: false, type: 'text', text: 'This is our little corner of the internet.', time: 'Monday', timestamp: stamp - 259200000 },
]
