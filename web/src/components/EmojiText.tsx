// A tiny, bundled emoji set keeps the interface consistent without remote requests
// or a multi-megabyte color-emoji font. Other emoji use the device's native font.
const available = ['😊', '🌿', '🤍', '✨', '👍', '☕', '🎉', '🙌', '🌻', '😂', '💚', '🏔️', '👋', '🤝', '💬', '🌱']
const pattern = new RegExp(`(${available.join('|')})`, 'gu')
export function EmojiText({ text }: { text: string }) {
  return <>{text.split(pattern).map((part, index) => available.includes(part) ? <img key={index} className="inline-emoji" src={`/emojis/${Array.from(part).filter(char => char.codePointAt(0) !== 0xfe0f).map(char => char.codePointAt(0)!.toString(16)).join('-')}.svg`} alt={part}/> : part)}</>
}
