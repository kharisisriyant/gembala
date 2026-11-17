const EVENT = "gembala:celebrate"

/** Send `sheep` sheep trotting across the bottom of the screen (rendered by `SheepParade`). */
export function celebrate(sheep = 1) {
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: sheep }))
}

export function onCelebrate(handler: (sheep: number) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<number>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
