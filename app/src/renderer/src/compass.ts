// The compass of the map, in 2D and in 3D (Map.svelte owns it; terrain3d.ts turns it with the 3D view).
import * as THREE from 'three'

/**
 * The compass: a small bronze object of its own, on its own canvas, lying on the ground as the view
 * does at half its tilt (flat over the 2D map, turned as it is). No light on it: each part keeps its colour; a light from the north-west
 * only casts the shadows of the needle and the N on the face (ui.md).
 */
export class Compass {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-55, 55, 55, -55, 1, 1000)

  constructor(host: HTMLElement) {
    const r = this.renderer
    r.setPixelRatio(devicePixelRatio)
    r.setSize(110, 110)
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFShadowMap
    host.append(r.domElement)
    const flat = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color })
    const bronze = flat(0xa37e4f),
      darkBronze = flat(0x583e2a),
      ivory = flat(0xeacba4)
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0, shadow = true): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat)
      m.position.y = y
      m.castShadow = shadow
      m.receiveShadow = true
      this.scene.add(m)
      return m
    }
    // Bezel: a raised bronze lip round a face sunk into it, its light painted on: dark at the foot,
    // pale on the lip, the inner slope darker, brighter on the north-west side.
    const bezel = new THREE.LatheGeometry(
      [
        [40, 0],
        [47, 0],
        [47.5, 4.5],
        [46, 7],
        [42.5, 7.2],
        [40.5, 5.5],
        [40, 3.5],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      96,
    )
    const p = bezel.attributes.position!,
      colors = new Float32Array(p.count * 3),
      dark = new THREE.Color(0x583e2a),
      pale = new THREE.Color(0xcfb08a),
      c = new THREE.Color()
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        r = Math.hypot(x, z) || 1
      c.copy(dark)
        .lerp(pale, Math.min(1, y / 7.2))
        .multiplyScalar((r < 42.6 ? 0.8 : 1) * (0.8 + 0.25 * ((-x - z) / (r * Math.SQRT2))))
      c.toArray(colors, i * 3)
    }
    bezel.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    add(bezel, new THREE.MeshBasicMaterial({ vertexColors: true }))
    add(new THREE.CylinderGeometry(40.2, 40.2, 4, 96), flat(0x382e25), 1.5, false)
    add(new THREE.CircleGeometry(40.2, 96).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.8 }), 3.55, false)
    // Ticks: long at north, east, south and west, short between.
    for (let i = 0; i < 8; i++) {
      const long = i % 2 === 0,
        t = add(new THREE.BoxGeometry(1.8, 1.2, long ? 6 : 3.5), long ? bronze : darkBronze, 4)
      const a = (i * Math.PI) / 4,
        r = long ? 35 : 36
      t.position.x = Math.sin(a) * r
      t.position.z = -Math.cos(a) * r
      t.rotation.y = -a
    }
    // A flat shape lifted off the face, drawn with +y to the north, thick by depth.
    const raised = (points: number[][], depth: number, mat: THREE.Material, y: number): THREE.Mesh => {
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z))), {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.4,
        bevelSize: 0.4,
        bevelSegments: 2,
      })
      geo.rotateX(-Math.PI / 2)
      return add(geo, mat, y)
    }
    const n = raised(
      [
        [-4, -5.5],
        [-2.3, -5.5],
        [-2.3, 2],
        [2.5, -5.5],
        [4, -5.5],
        [4, 5.5],
        [2.3, 5.5],
        [2.3, -2],
        [-2.5, 5.5],
        [-4, 5.5],
      ],
      1.4,
      ivory,
      6,
    )
    n.position.z = -22
    // The needle on its pin, higher still: red to the north, ivory to the south.
    raised(
      [
        [0, 17],
        [5.5, 0],
        [-5.5, 0],
      ],
      1.6,
      flat(0xb3261a),
      9.5,
    )
    raised(
      [
        [0, -13],
        [5.5, 0],
        [-5.5, 0],
      ],
      1.6,
      ivory,
      9.5,
    )
    add(new THREE.CylinderGeometry(1.6, 2.2, 7, 24), darkBronze, 6.5)
    add(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bronze, 11.5)
    const sun = new THREE.DirectionalLight(0xffffff, 1)
    sun.position.set(-60, 110, -60)
    sun.castShadow = true
    Object.assign(sun.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 1,
      far: 400,
    })
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.bias = -0.002
    this.scene.add(sun)
  }

  turn(polar: number, azimuth: number): void {
    this.camera.position.setFromSphericalCoords(300, Math.max(polar, 1e-3), azimuth)
    this.camera.lookAt(0, 0, 0)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
