import * as THREE from 'three'
import type { RodConfig } from './rodConfig'
import { buildTakeoffZone } from './trajectoryPlaneDecorations'

const SUBJECT_ROD_HEIGHT = 170
const SUBJECT2_CROSSBAR_HEIGHT = 150
const ROD_RADIUS = 1.8
const TAKEOFF_ZONE_Z = 0.12

const isFiniteRodPoint = (point?: { x?: number; y?: number }): point is { x: number; y: number } =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))

export const renderSubjectRods = (
  scene: THREE.Scene,
  rodConfig: RodConfig | undefined,
  disposers: Array<() => void>,
) => {
  const rodMaterial = new THREE.MeshStandardMaterial({
    color: '#ff7a45',
    metalness: 0.18,
    roughness: 0.48,
  })
  const crossbarMaterial = new THREE.MeshStandardMaterial({
    color: '#ff9c6e',
    metalness: 0.2,
    roughness: 0.4,
  })
  const rodGeometry = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, SUBJECT_ROD_HEIGHT, 20)

  const addVerticalRod = (x: number, y: number) => {
    const rod = new THREE.Mesh(rodGeometry, rodMaterial)
    rod.rotation.x = Math.PI / 2
    rod.position.set(x, y, SUBJECT_ROD_HEIGHT / 2)
    scene.add(rod)
  }

  const addCrossbar = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    const length = direction.length()
    if (length <= 0.001) {
      return
    }
    direction.normalize()
    const geometry = new THREE.CylinderGeometry(ROD_RADIUS * 0.72, ROD_RADIUS * 0.72, length, 16)
    const crossbar = new THREE.Mesh(geometry, crossbarMaterial)
    crossbar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    crossbar.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, SUBJECT2_CROSSBAR_HEIGHT)
    scene.add(crossbar)
    disposers.push(() => geometry.dispose())
  }

  const subject1Rod = rodConfig?.subject1[0]
  if (isFiniteRodPoint(subject1Rod)) {
    addVerticalRod(subject1Rod.x, subject1Rod.y)
  }

  const subject2RodA = rodConfig?.subject2[0]
  const subject2RodB = rodConfig?.subject2[1]
  if (isFiniteRodPoint(subject2RodA) && isFiniteRodPoint(subject2RodB)) {
    addVerticalRod(subject2RodA.x, subject2RodA.y)
    addVerticalRod(subject2RodB.x, subject2RodB.y)
    addCrossbar(subject2RodA, subject2RodB)
  }

  disposers.push(() => {
    rodGeometry.dispose()
    rodMaterial.dispose()
    crossbarMaterial.dispose()
  })
}

export const renderTakeoffZoneOnGround = (
  scene: THREE.Scene,
  rodConfig: RodConfig | undefined,
  disposers: Array<() => void>,
) => {
  const takeoffZone = buildTakeoffZone(rodConfig)
  if (takeoffZone.length !== 4) {
    return
  }

  const shape = new THREE.Shape()
  shape.moveTo(takeoffZone[0].x, takeoffZone[0].y)
  takeoffZone.slice(1).forEach((point) => shape.lineTo(point.x, point.y))
  shape.lineTo(takeoffZone[0].x, takeoffZone[0].y)

  const geometry = new THREE.ShapeGeometry(shape)
  const material = new THREE.MeshBasicMaterial({
    color: '#73d13d',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.z = TAKEOFF_ZONE_Z
  scene.add(mesh)

  disposers.push(() => {
    geometry.dispose()
    material.dispose()
  })
}
