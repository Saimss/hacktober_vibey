export {}
declare global {
  interface Window {
    pet: {
      workArea(): Promise<{ x: number; y: number; width: number; height: number }>
      moveTo(x: number, y: number): void
      openDashboard(): void
      openUrl(url: string): void
      greet(ctx: { mood: string; petName: string }): Promise<unknown>
      chat(payload: {
        messages: { role: 'user' | 'assistant'; content: string }[]
        mood: string
        petName: string
      }): Promise<{ ok: true; text: string } | { ok: false; error: string }>
    }
  }
}
