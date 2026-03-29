import * as THREE from 'three'
import { EDITABLE_BLOCK_TYPES } from './trajectoryPlaneUtils'
import type { Visit } from './trajectoryUtils'

export type MovePointPayload = {
  blockId: string
  blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
  x: number
  y: number
  baseX?: number
  baseY?: number
}

export type PickCandidate = {
  blockId: string
  position: THREE.Vector3
}

export type DragCandidate = PickCandidate & {
  blockType: 'Goertek_MoveToCoord2' | 'Goertek_Move'
  x: number
  y: number
  baseX?: number
  baseY?: number
}

export const createGridLine = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
): { line: THREE.Line; dispose: () => void } => {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
  const line = new THREE.Line(geometry, material)
  const dispose = () => {
    geometry.dispose()
    material.dispose()
  }

  return { line, dispose }
}

export const buildPickCandidates = (visits: Visit[], pointOffsetZ: number): PickCandidate[] =>
  visits.flatMap((visit) => {
    if (!visit.blockId) {
      return []
    }
    return [
      {
        blockId: visit.blockId,
        position: new THREE.Vector3(visit.x, visit.y, visit.z + pointOffsetZ),
      },
    ]
  })

export const buildDragCandidates = (visits: Visit[], pointOffsetZ: number): DragCandidate[] =>
  visits.flatMap((visit) => {
    if (!visit.blockId || !visit.blockType || !EDITABLE_BLOCK_TYPES.has(visit.blockType)) {
      return []
    }
    return [
      {
        blockId: visit.blockId,
        blockType: visit.blockType as 'Goertek_MoveToCoord2' | 'Goertek_Move',
        x: visit.x,
        y: visit.y,
        baseX: visit.baseX,
        baseY: visit.baseY,
        position: new THREE.Vector3(visit.x, visit.y, visit.z + pointOffsetZ),
      },
    ]
  })

export const pickNearestAtPointer = <T extends PickCandidate>(
  event: PointerEvent,
  candidates: T[],
  camera: THREE.PerspectiveCamera,
  element: HTMLElement,
  maxDistancePx = 14,
): T | null => {
  if (!candidates.length) {
    return null
  }

  const rect = element.getBoundingClientRect()
  let minDistance = Number.POSITIVE_INFINITY
  let nearest: T | null = null

  candidates.forEach((candidate) => {
    const projected = candidate.position.clone().project(camera)
    if (projected.z < -1 || projected.z > 1) {
      return
    }
    const screenX = (projected.x * 0.5 + 0.5) * rect.width + rect.left
    const screenY = (-projected.y * 0.5 + 0.5) * rect.height + rect.top
    const distance = Math.hypot(event.clientX - screenX, event.clientY - screenY)
    if (distance < minDistance) {
      minDistance = distance
      nearest = candidate
    }
  })

  return minDistance <= maxDistancePx ? nearest : null
}

export const projectPointerToPlane = (
  event: PointerEvent,
  element: HTMLElement,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster,
  pointer: THREE.Vector2,
  plane: THREE.Plane,
  hit: THREE.Vector3,
  z: number,
) => {
  const rect = element.getBoundingClientRect()
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1
  pointer.set(nx, ny)
  raycaster.setFromCamera(pointer, camera)
  plane.constant = -z
  return raycaster.ray.intersectPlane(plane, hit)
}
