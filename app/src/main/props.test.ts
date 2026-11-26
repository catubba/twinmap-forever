import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KEPT_BITS } from '../shared/props'
import { standingAt, thinned } from './props'
import { servedFile } from './tiles'

describe('the trees and objects of the 3D view', () => {
  it('stand as a building does: turned round y, scaled, moved, as three.js places it', () => {
    const m = standingAt(100, 20, -50, 0.7, 1.5), o = new THREE.Object3D()
    o.position.set(100, 20, -50)
    o.rotation.y = 0.7
    o.scale.setScalar(1.5)
    o.updateMatrix()
    const p = new THREE.Vector3(3, 4, 5)
    const ours = new THREE.Vector3(m[0]! * 3 + m[3]! * 4 + m[6]! * 5 + m[9]!, m[1]! * 3 + m[4]! * 4 + m[7]! * 5 + m[10]!, m[2]! * 3 + m[5]! * 4 + m[8]! * 5 + m[11]!)
    expect(ours.distanceTo(p.applyMatrix4(o.matrix))).toBeLessThan(1e-9)
  })

  it('thin the woods: fewer trees with few than many, the same ones whatever the order they come in', () => {
    let seed = 7
    const random = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const wood = Array.from({ length: 600 }, () => ({ x: random() * 200, z: random() * 200, crown: 3 + random() * 4 }))
    const bits = thinned(wood)
    const count = (bit: number): number => bits.filter((b) => b & bit).length
    expect(count(KEPT_BITS.few)).toBeLessThan(count(KEPT_BITS.some))
    expect(count(KEPT_BITS.some)).toBeLessThan(count(KEPT_BITS.many))
    expect(count(KEPT_BITS.many)).toBeLessThan(wood.length)
    const back = thinned(wood.slice().reverse()).reverse()
    expect([...back]).toEqual([...bits])
    // a lone tree is always kept
    expect(thinned([{ x: 0, z: 0, crown: 9 }])[0]).toBe(KEPT_BITS.few | KEPT_BITS.some | KEPT_BITS.many)
  })

  it('are served by model and by block, nothing else', () => {
    expect(servedFile('/b', '/buildings/m2/189077.bin')).toMatch(/buildings[\\/]m2[\\/]189077\.bin$/)
    expect(servedFile('/b', '/azeroth/props.json')).toMatch(/azeroth[\\/]props\.json$/)
    expect(servedFile('/b', '/kalimdor/props/31-49.bin')).toMatch(/kalimdor[\\/]props[\\/]31-49\.bin$/)
    expect(servedFile('/b', '/buildings/m2/format.json')).toBeNull()
    expect(servedFile('/b', '/azeroth/props/../x.bin')).toBeNull()
  })
})
