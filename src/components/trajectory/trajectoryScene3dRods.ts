import * as THREE from 'three'
import type { RodConfig } from './rodConfig'
import { buildTakeoffZone } from './trajectoryPlaneDecorations'

const DEFAULT_ROD_HEIGHT = 170
const SUBJECT2_CROSSBAR_HEIGHT = 150
const SUBJECT6_CROSSBAR_HEIGHT = 150
const SUBJECT3_RING_DIAMETER = 65
const SUBJECT4_RING_DIAMETER = 65
const SUBJECT4_RING_CENTER_HEIGHT = 120
const SUBJECT7_RING_DIAMETER = 65
const SUBJECT7_RING_HEIGHTS = [100, 125, 150] as const
const SUBJECT8_RING_DIAMETER = 65
const SUBJECT8_HIGH_RING_CENTER_HEIGHT = 150
const SUBJECT8_LOW_RING_CENTER_HEIGHT = 110
const SUBJECT9_FIRST_CROSSBAR_HEIGHT = 150
const ROD_RADIUS = 1.8
const RING_TUBE_RADIUS = 1.35
const TAKEOFF_ZONE_Z = 0.12

export type RodObstacleHoverTarget3D = {
  key: string
  pickObject: THREE.Object3D
  highlightObject?: THREE.Mesh
}

const isFiniteRodPoint = (point?: { x?: number; y?: number }): point is { x: number; y: number } =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))

const isFiniteNumber = (value: number | undefined): value is number => Number.isFinite(value)

export const renderSubjectRods = (
  scene: THREE.Scene,
  rodConfig: RodConfig | undefined,
  disposers: Array<() => void>,
  hoverTargets?: RodObstacleHoverTarget3D[],
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
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd666',
    metalness: 0.16,
    roughness: 0.36,
  })

  const rodHeight = rodConfig?.verticalRodHeight ?? DEFAULT_ROD_HEIGHT
  const rodGeometry = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, rodHeight, 20)
  const subject3RingGeometry = new THREE.TorusGeometry(SUBJECT3_RING_DIAMETER / 2, RING_TUBE_RADIUS, 18, 48)
  const subject4RingGeometry = new THREE.TorusGeometry(SUBJECT4_RING_DIAMETER / 2, RING_TUBE_RADIUS, 18, 48)
  const subject7RingGeometry = new THREE.TorusGeometry(SUBJECT7_RING_DIAMETER / 2, RING_TUBE_RADIUS, 18, 48)
  const subject8RingGeometry = new THREE.TorusGeometry(SUBJECT8_RING_DIAMETER / 2, RING_TUBE_RADIUS, 18, 48)
  const addHoverTargets = (
    key: string | undefined,
    object: THREE.Mesh,
    expandedGeometry: THREE.BufferGeometry | null,
  ) => {
    if (!hoverTargets || !key) {
      return
    }
    hoverTargets.push({ key, pickObject: object, highlightObject: object })
    if (!expandedGeometry) {
      return
    }
    const expandedMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const expandedMesh = new THREE.Mesh(expandedGeometry, expandedMaterial)
    expandedMesh.position.copy(object.position)
    expandedMesh.quaternion.copy(object.quaternion)
    expandedMesh.scale.copy(object.scale)
    scene.add(expandedMesh)
    hoverTargets.push({ key, pickObject: expandedMesh, highlightObject: object })
    disposers.push(() => {
      expandedGeometry.dispose()
      expandedMaterial.dispose()
    })
  }

  const addVerticalRod = (x: number, y: number) => {
    const rod = new THREE.Mesh(rodGeometry, rodMaterial)
    rod.rotation.x = Math.PI / 2
    rod.position.set(x, y, rodHeight / 2)
    scene.add(rod)
  }

  const addCrossbar = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    height: number,
    hoverKey?: string,
  ) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    const length = direction.length()
    if (length <= 0.001) {
      return
    }
    direction.normalize()
    const geometry = new THREE.CylinderGeometry(ROD_RADIUS * 0.72, ROD_RADIUS * 0.72, length, 16)
    const crossbar = new THREE.Mesh(geometry, crossbarMaterial)
    crossbar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    crossbar.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, height)
    scene.add(crossbar)
    addHoverTargets(
      hoverKey,
      crossbar,
      new THREE.CylinderGeometry(ROD_RADIUS * 1.9, ROD_RADIUS * 1.9, length, 14),
    )
    disposers.push(() => geometry.dispose())
  }

  const addSubject3Ring = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    centerHeight: number,
    hoverKey?: string,
  ) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    if (direction.lengthSq() < 0.001) {
      return
    }
    direction.normalize()
    const ring = new THREE.Mesh(subject3RingGeometry, ringMaterial)
    const planeNormal = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 0, 1))
    if (planeNormal.lengthSq() > 0.001) {
      planeNormal.normalize()
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), planeNormal)
    }
    ring.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, centerHeight)
    scene.add(ring)
    addHoverTargets(
      hoverKey,
      ring,
      new THREE.TorusGeometry(SUBJECT3_RING_DIAMETER / 2, RING_TUBE_RADIUS * 2.5, 18, 48),
    )
  }

  const addSubject4Ring = (start: { x: number; y: number }, end: { x: number; y: number }, hoverKey?: string) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    if (direction.lengthSq() < 0.001) {
      return
    }
    const ring = new THREE.Mesh(subject4RingGeometry, ringMaterial)
    ring.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, SUBJECT4_RING_CENTER_HEIGHT)
    scene.add(ring)
    addHoverTargets(
      hoverKey,
      ring,
      new THREE.TorusGeometry(SUBJECT4_RING_DIAMETER / 2, RING_TUBE_RADIUS * 2.5, 18, 48),
    )
  }

  const addSubject7Rings = (start: { x: number; y: number }, end: { x: number; y: number }, hoverKey?: string) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    if (direction.lengthSq() < 0.001) {
      return
    }
    const centerX = (start.x + end.x) / 2
    const centerY = (start.y + end.y) / 2
    for (const height of SUBJECT7_RING_HEIGHTS) {
      const ring = new THREE.Mesh(subject7RingGeometry, ringMaterial)
      ring.position.set(centerX, centerY, height)
      scene.add(ring)
      addHoverTargets(
        hoverKey,
        ring,
        new THREE.TorusGeometry(SUBJECT7_RING_DIAMETER / 2, RING_TUBE_RADIUS * 2.5, 18, 48),
      )
    }
  }

  const addSubject8Ring = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    centerHeight: number,
    hoverKey?: string,
  ) => {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, 0)
    if (direction.lengthSq() < 0.001) {
      return
    }
    const ring = new THREE.Mesh(subject8RingGeometry, ringMaterial)
    ring.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, centerHeight)
    scene.add(ring)
    addHoverTargets(
      hoverKey,
      ring,
      new THREE.TorusGeometry(SUBJECT8_RING_DIAMETER / 2, RING_TUBE_RADIUS * 2.5, 18, 48),
    )
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
    addCrossbar(subject2RodA, subject2RodB, SUBJECT2_CROSSBAR_HEIGHT, 'subject2-hover')
  }

  const subject3RodA = rodConfig?.subject3[0]
  const subject3RodB = rodConfig?.subject3[1]
  if (isFiniteRodPoint(subject3RodA) && isFiniteRodPoint(subject3RodB)) {
    addVerticalRod(subject3RodA.x, subject3RodA.y)
    addVerticalRod(subject3RodB.x, subject3RodB.y)
    const centerHeight = rodConfig?.subject3Ring.centerHeight
    if (isFiniteNumber(centerHeight)) {
      addSubject3Ring(subject3RodA, subject3RodB, centerHeight, 'subject3-hover')
    }
  }

  const subject4RodA = rodConfig?.subject4[0]
  const subject4RodB = rodConfig?.subject4[1]
  if (isFiniteRodPoint(subject4RodA) && isFiniteRodPoint(subject4RodB)) {
    addVerticalRod(subject4RodA.x, subject4RodA.y)
    addVerticalRod(subject4RodB.x, subject4RodB.y)
    addSubject4Ring(subject4RodA, subject4RodB, 'subject4-hover')
  }

  const subject5RodA = rodConfig?.subject5[0]
  const subject5RodB = rodConfig?.subject5[1]
  if (isFiniteRodPoint(subject5RodA) && isFiniteRodPoint(subject5RodB)) {
    addVerticalRod(subject5RodA.x, subject5RodA.y)
    addVerticalRod(subject5RodB.x, subject5RodB.y)
  }

  const subject6RodA = rodConfig?.subject6[0]
  const subject6RodB = rodConfig?.subject6[1]
  const subject6RodC = rodConfig?.subject6[2]
  const subject6RodD = rodConfig?.subject6[3]
  if (
    isFiniteRodPoint(subject6RodA) &&
    isFiniteRodPoint(subject6RodB) &&
    isFiniteRodPoint(subject6RodC) &&
    isFiniteRodPoint(subject6RodD)
  ) {
    addVerticalRod(subject6RodA.x, subject6RodA.y)
    addVerticalRod(subject6RodB.x, subject6RodB.y)
    addVerticalRod(subject6RodC.x, subject6RodC.y)
    addVerticalRod(subject6RodD.x, subject6RodD.y)
    addCrossbar(subject6RodA, subject6RodB, SUBJECT6_CROSSBAR_HEIGHT, 'subject6-hover-a')
    addCrossbar(subject6RodC, subject6RodD, SUBJECT6_CROSSBAR_HEIGHT, 'subject6-hover-b')
  }

  const subject7RodA = rodConfig?.subject7[0]
  const subject7RodB = rodConfig?.subject7[1]
  if (isFiniteRodPoint(subject7RodA) && isFiniteRodPoint(subject7RodB)) {
    addVerticalRod(subject7RodA.x, subject7RodA.y)
    addVerticalRod(subject7RodB.x, subject7RodB.y)
    addSubject7Rings(subject7RodA, subject7RodB, 'subject7-hover')
  }

  const subject8RodA = rodConfig?.subject8[0]
  const subject8RodB = rodConfig?.subject8[1]
  const subject8RodC = rodConfig?.subject8[2]
  if (isFiniteRodPoint(subject8RodA) && isFiniteRodPoint(subject8RodB) && isFiniteRodPoint(subject8RodC)) {
    addVerticalRod(subject8RodA.x, subject8RodA.y)
    addVerticalRod(subject8RodB.x, subject8RodB.y)
    addVerticalRod(subject8RodC.x, subject8RodC.y)
    addSubject8Ring(subject8RodA, subject8RodB, SUBJECT8_HIGH_RING_CENTER_HEIGHT, 'subject8-hover-high')
    addSubject8Ring(subject8RodB, subject8RodC, SUBJECT8_LOW_RING_CENTER_HEIGHT, 'subject8-hover-low')
  }

  const subject9RodA = rodConfig?.subject9[0]
  const subject9RodB = rodConfig?.subject9[1]
  const subject9SecondCrossbarHeight = rodConfig?.subject9Config.secondCrossbarHeight
  if (isFiniteRodPoint(subject9RodA) && isFiniteRodPoint(subject9RodB)) {
    addVerticalRod(subject9RodA.x, subject9RodA.y)
    addVerticalRod(subject9RodB.x, subject9RodB.y)
    addCrossbar(subject9RodA, subject9RodB, SUBJECT9_FIRST_CROSSBAR_HEIGHT, 'subject9-hover')
    if (isFiniteNumber(subject9SecondCrossbarHeight)) {
      addCrossbar(subject9RodA, subject9RodB, subject9SecondCrossbarHeight, 'subject9-hover')
    }
  }

  disposers.push(() => {
    rodGeometry.dispose()
    subject3RingGeometry.dispose()
    subject4RingGeometry.dispose()
    subject7RingGeometry.dispose()
    subject8RingGeometry.dispose()
    rodMaterial.dispose()
    crossbarMaterial.dispose()
    ringMaterial.dispose()
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
