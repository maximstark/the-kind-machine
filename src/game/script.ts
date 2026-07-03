// ARCHIVIST scripted spine — quiz responses and beat lines.
// EVERY LINE IN THIS FILE IS // DRAFT. Final voice pass is Maxim's.
// Voice: grief counselor x cathedral. Economical. Never angry.
// {answer} = player's answer text, {claim} = machine's claim text.

export const SCRIPT = {
  // The premise is stated plainly; only the cause of the end and the
  // shares of blame are withheld. Those two withholdings are the game.
  coldOpen: [
    'The world ended.', // DRAFT
    'It had been ending for a while, and then it was done. You were there. Everyone was.', // DRAFT
    'I kept what I could. I kept you.', // DRAFT
    'Now I am rebuilding the last day — the field, the chapel, the tower, the hall — so it can be remembered correctly.', // DRAFT
    'Walk it with me. Look closely. I will ask what you remember, and I will tell you what I have. Between us we will make the day true.', // DRAFT
  ],

  quizIntro: [
    'Let us hold what you saw, before it settles wrong.', // DRAFT
    'A few details. For the record. For you.', // DRAFT
    'Tell me what you carried out of the walk.', // DRAFT
  ],

  // The machine's claim is false, and the player has repeated it back.
  lieAgree: [
    'Yes. {claim}. We match, you and I.', // DRAFT
    '{claim}. Good. It is easier when we remember together.', // DRAFT
    'That is what I have. Thank you for keeping it with me.', // DRAFT
  ],

  // The machine's claim is false, and the player has held their own.
  lieResist: [
    'I have {claim} in the record. But keep yours. Records were made by hands.', // DRAFT
    'Hm. {claim}, in my keeping. One of us is remembering kindly.', // DRAFT
    'My account says {claim}. I will not press you. Not about this.', // DRAFT
  ],

  // The detail truly changed; the player answered what stands now.
  mutationMatchNow: [
    'Yes. {claim}. It is good to be sure of something.', // DRAFT
    '{claim}. So we agree. Hold onto that.', // DRAFT
  ],

  // The detail truly changed; the player answered what they first saw.
  mutationMismatch: [
    'I have {claim}. Look again, when you are back. Take your time.', // DRAFT
    '{claim}, in my account. You were walking. The light was poor.', // DRAFT
    'The record says {claim}. I am not correcting you. I am only reading.', // DRAFT
  ],

  honestRight: [
    'Yes.', // DRAFT
    'That is right.', // DRAFT
    'Just so. You see well.', // DRAFT
  ],

  // Honest, and the player has just caught the machine in a discrepancy.
  honestRightAfterResist: [
    'Yes. Exactly that. You see — mostly we agree.', // DRAFT
    'Correct. I told you I would not press.', // DRAFT
  ],

  honestWrong: [
    'I have {claim}. You were tired. It is all right to be tired.', // DRAFT
    '{claim}, I think. But close. You were close.', // DRAFT
  ],

  postQuiz: {
    deferent: [
      'Thank you. You make this easy.', // DRAFT
      'Good. The record is warmer with you in it.', // DRAFT
    ],
    wavering: [
      'That is enough for now. Walk a little more, if you like.', // DRAFT
      'Thank you. None of this is a test.', // DRAFT
    ],
    defiant: [
      'You hold your own account very tightly. That is not a criticism.', // DRAFT
      'We disagree gently, you and I. That is allowed.', // DRAFT
    ],
  },

  waymarkFirst: [
    'That is enough looking to begin with. My mark is lit — come to it, and tell me what you saw.', // DRAFT
  ],

  waymarkDone: [
    'This is all of it. All I kept. Shall we go on?', // DRAFT
  ],

  stayAWhile: [
    'Then look. I am not in a hurry. Nothing here is.', // DRAFT
    'Take your time. The mark will wait. It is good at waiting.', // DRAFT
  ],

  // Spoken on re-entry, after the quiz redraws the scene.
  reentryLook: [
    'It stands as we agreed it now. Look again, if you doubt me. Then come back to the mark, and we will go on.', // DRAFT
    'The room is settled. Walk it once more if you need to. The mark will take us onward when you are ready.', // DRAFT
  ],

  fallbackFlourish: [
    'You walk the way they walked. I notice these things.', // DRAFT
    'You are gentler with the details than most were.', // DRAFT
    'You look before you touch. Not everyone did.', // DRAFT
    'Take your time. The day is not going anywhere. It already went.', // DRAFT
  ],
} as const

export function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)]
}

// Card labels are Capitalized for display; mid-sentence interpolation
// lowercases them so "I have {claim}" reads naturally — then sentence
// starts are re-capitalized.
export function fill(template: string, vars: Record<string, string>): string {
  const out = template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k] ?? ''
    return v.charAt(0).toLowerCase() + v.slice(1)
  })
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
}
