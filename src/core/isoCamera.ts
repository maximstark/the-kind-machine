import * as THREE from 'three'

// Classic iso: orthographic, azimuth 45deg, elevation ~30deg.
// viewHeight = world units visible vertically; awe is a camera setting.

export class IsoRig {
  readonly cam: THREE.OrthographicCamera
  private center = new THREE.Vector3()
  private viewHeight = 12
  private aspect = 0.5
  azimuth = Math.PI / 4
  elevation = THREE.MathUtils.degToRad(30)
  distance = 60

  constructor() {
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
  }

  setAspect(aspect: number) {
    this.aspect = aspect
    this.updateFrustum()
  }

  frame(center: THREE.Vector3, viewHeight: number) {
    this.center.copy(center)
    this.viewHeight = viewHeight
    this.updateFrustum()
    this.updatePosition()
  }

  // Portrait-first: width is the scarce dimension, so frame by it.
  frameWidth(center: THREE.Vector3, viewWidth: number) {
    this.frame(center, viewWidth / this.aspect)
  }

  moveCenter(center: THREE.Vector3) {
    this.center.copy(center)
    this.updatePosition()
  }

  setViewHeight(h: number) {
    this.viewHeight = h
    this.updateFrustum()
  }
  getViewHeight() {
    return this.viewHeight
  }
  getViewWidth() {
    return this.viewHeight * this.aspect
  }
  setViewWidth(w: number) {
    this.setViewHeight(w / this.aspect)
  }
  getCenter() {
    return this.center.clone()
  }

  private updateFrustum() {
    const halfH = this.viewHeight / 2
    const halfW = halfH * this.aspect
    this.cam.left = -halfW
    this.cam.right = halfW
    this.cam.top = halfH
    this.cam.bottom = -halfH
    this.cam.updateProjectionMatrix()
  }

  private updatePosition() {
    const d = this.distance
    const el = this.elevation
    const az = this.azimuth
    this.cam.position.set(
      this.center.x + d * Math.cos(el) * Math.cos(az),
      this.center.y + d * Math.sin(el),
      this.center.z + d * Math.cos(el) * Math.sin(az)
    )
    this.cam.lookAt(this.center)
    this.cam.updateMatrixWorld()
  }
}
