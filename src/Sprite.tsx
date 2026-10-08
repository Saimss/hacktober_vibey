import { useEffect, useState, HTMLAttributes } from 'react'
import { FPS, Anims, getAnims } from './sprites'
import type { Mood } from './state'

type Props = { name: Mood; size: number; flip?: boolean } & HTMLAttributes<HTMLDivElement>

// Plays src/sprites/<mood>.png with a pure-CSS steps() animation (see @keyframes sprite-play in the CSS files),
// so there is no JavaScript running per frame.
export function Sprite({ name, size, flip, style, ...rest }: Props) {
  const [anims, setAnims] = useState<Anims>()
  useEffect(() => { getAnims().then(setAnims) }, [])
  const a = anims?.[name] ?? anims?.idle
  if (!a) return null
  return (
    <div
      {...rest}
      style={{
        width: size, height: size, imageRendering: 'pixelated', backgroundRepeat: 'no-repeat',
        backgroundImage: `url(${a.url})`, backgroundSize: `${a.frames * size}px ${size}px`, backgroundPosition: '0 0',
        ['--end' as string]: `${-a.frames * size}px`,
        animation: `sprite-play ${(a.frames / FPS[name]).toFixed(3)}s steps(${a.frames}) infinite`,
        transform: flip ? 'scaleX(-1)' : undefined, ...style,
      }}
    />
  )
}
