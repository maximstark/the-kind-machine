import * as THREE from 'three'

// The five colors. Everything on screen quantizes to these.
// Index 4 (machine green) is reserved for machine UI — the world
// quantizer skips it unless a UI pixel is present.
export const PALETTE_HEX = {
  bone: 0xe8dfc9,
  ash: 0x7e7b72,
  black: 0x131118,
  gold: 0xa8842e,
  green: 0x5fae7c,
} as const

export const PALETTE = [
  new THREE.Color(PALETTE_HEX.bone),
  new THREE.Color(PALETTE_HEX.ash),
  new THREE.Color(PALETTE_HEX.black),
  new THREE.Color(PALETTE_HEX.gold),
  new THREE.Color(PALETTE_HEX.green),
]

export const CSS = {
  bone: '#e8dfc9',
  ash: '#7e7b72',
  black: '#131118',
  gold: '#a8842e',
  green: '#5fae7c',
} as const
