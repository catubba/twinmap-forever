// What leaflet-rotate adds to Leaflet, as far as the map uses it: it ships no types of its own.
import 'leaflet'

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean
    shiftKeyRotate?: boolean
    pitchDrag?: boolean
    touchRotate?: boolean
  }
  interface Map {
    /** The way at the top of the map, in degrees anticlockwise from north. */
    getBearing(): number
    setBearing(degrees: number): this
  }
}
