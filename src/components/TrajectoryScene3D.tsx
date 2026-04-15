import { Empty } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { RodConfig } from './trajectory/rodConfig'
import { renderSubjectRods, renderTakeoffZoneOnGround } from './trajectory/trajectoryScene3dRods'
import { SNAP_STEP, snapToStep } from './trajectory/trajectoryPlaneUtils'
import {
  buildDragCandidates,
  buildPickCandidates,
  createGridLine,
  pickNearestAtPointer,
  projectPointerToPlane,
  type DragCandidate,
  type MovePointPayload,
  type PickCandidate,
} from './trajectory/trajectoryScene3dUtils'
import type { TrajectoryBounds, Visit } from './trajectory/trajectoryUtils'
import { GRID_STEP } from './trajectory/trajectoryUtils'
type Props = {
  visits: Visit[]
  bounds: TrajectoryBounds
  rodConfig?: RodConfig
  onLocateBlock?: (blockId: string) => void
  onMovePoint?: (payload: MovePointPayload) => void
  backgroundTrajectories?: Array<{ droneId: string; color: string; visits: Visit[] }>
  activeTrajectoryColor?: string
}
function TrajectoryScene3D({
  visits,
  bounds,
  rodConfig,
  onLocateBlock,
  onMovePoint,
  backgroundTrajectories = [],
  activeTrajectoryColor = '#1b6ed6',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneStateRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.PerspectiveCamera | null
    renderer: THREE.WebGLRenderer | null
    controls: OrbitControls | null
    disposers: Array<() => void>
    pathLine: THREE.Line | null
    pathGeometry: THREE.BufferGeometry | null
    startMarker: THREE.Mesh | null
    endMarker: THREE.Mesh | null
    hoverMesh: THREE.Mesh | null
    pickCandidatesRef: { current: PickCandidate[] }
    dragCandidatesRef: { current: DragCandidate[] }
    activeTrajectoryColorRef: { current: string }
    pointOffsetZ: number
    isFirstMount: boolean
  } | null>(null)

  const center = useMemo(
    () => ({
      x: bounds.minX + bounds.span / 2,
      y: bounds.minY + bounds.span / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    }),
    [bounds.maxZ, bounds.minX, bounds.minY, bounds.minZ, bounds.span],
  )

  useEffect(() => {
    console.log('[TrajectoryScene3D] Effect RUN, container:', !!containerRef.current, 'sceneState:', !!sceneStateRef.current)
    const container = containerRef.current
    if (!container || !visits.length) {
      console.log('[TrajectoryScene3D] Effect SKIP - no container or visits')
      return
    }
    console.log('[TrajectoryScene3D] useEffect triggered, visits.length:', visits.length, 'bounds.span:', bounds.span)

    if (sceneStateRef.current?.scene && sceneStateRef.current?.camera && sceneStateRef.current?.renderer) {
      console.log('[TrajectoryScene3D] Re-render - preserving existing scene objects')
      return
    }

    console.log('[TrajectoryScene3D] First mount - creating new scene objects')
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#fafdff')
    const camera = new THREE.PerspectiveCamera(50, 1, 1, 12000)
    camera.up.set(0, 0, 1)
    const zSpan = Math.max(bounds.maxZ - bounds.minZ, GRID_STEP)
    const viewDistance = Math.max(bounds.span * 1.35, zSpan * 5, 260)
    camera.position.set(
      center.x + bounds.span * 0.7,
      center.y - viewDistance * 0.8,
      center.z + viewDistance * 0.75,
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(center.x, center.y, center.z)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.maxPolarAngle = Math.PI * 0.495
    const ambientLight = new THREE.AmbientLight('#d9e8ff', 0.85)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight('#ffffff', 0.9)
    directionalLight.position.set(bounds.maxX, bounds.minY - bounds.span, bounds.maxZ + bounds.span)
    scene.add(directionalLight)
    const disposers: Array<() => void> = []
    const groundGeometry = new THREE.PlaneGeometry(bounds.span, bounds.span)
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.position.set(center.x, center.y, 0)
    scene.add(ground)
    disposers.push(() => {
      groundGeometry.dispose()
      groundMaterial.dispose()
    })
    const gridGroup = new THREE.Group()
    for (let x = bounds.minX; x <= bounds.maxX; x += GRID_STEP) {
      const isMajor = (x - bounds.minX) % (GRID_STEP * 5) === 0
      const { line, dispose } = createGridLine(
        new THREE.Vector3(x, bounds.minY, 0.15),
        new THREE.Vector3(x, bounds.maxY, 0.15),
        isMajor ? 0xb8d2f4 : 0xdbe9f9,
      )
      gridGroup.add(line)
      disposers.push(dispose)
    }
    for (let y = bounds.minY; y <= bounds.maxY; y += GRID_STEP) {
      const isMajor = (y - bounds.minY) % (GRID_STEP * 5) === 0
      const { line, dispose } = createGridLine(
        new THREE.Vector3(bounds.minX, y, 0.15),
        new THREE.Vector3(bounds.maxX, y, 0.15),
        isMajor ? 0xb8d2f4 : 0xdbe9f9,
      )
      gridGroup.add(line)
      disposers.push(dispose)
    }
    scene.add(gridGroup)
    renderTakeoffZoneOnGround(scene, rodConfig, disposers)
    renderSubjectRods(scene, rodConfig, disposers)
    const pathPoints = visits.map((visit) => new THREE.Vector3(visit.x, visit.y, visit.z))
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints)
    const pathMaterial = new THREE.LineBasicMaterial({ color: activeTrajectoryColor })
    const pathLine = new THREE.Line(pathGeometry, pathMaterial)
    scene.add(pathLine)
    disposers.push(() => {
      pathGeometry.dispose()
      pathMaterial.dispose()
    })
    backgroundTrajectories.forEach((item) => {
      if (!item.visits.length) {
        return
      }
      const linePoints = item.visits.map((visit) => new THREE.Vector3(visit.x, visit.y, visit.z))
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints)
      const lineMaterial = new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.82 })
      scene.add(new THREE.Line(lineGeometry, lineMaterial))
      disposers.push(() => {
        lineGeometry.dispose()
        lineMaterial.dispose()
      })
    })
    const markerGeometry = new THREE.SphereGeometry(Math.max(bounds.span * 0.008, 2.8), 18, 18)
    const startMarkerMaterial = new THREE.MeshStandardMaterial({ color: '#1f8f3f' })
    const endMarkerMaterial = new THREE.MeshStandardMaterial({ color: '#db4f3d' })
    const startPoint = pathPoints[0]
    const endPoint = pathPoints[pathPoints.length - 1]
    const startMarker = new THREE.Mesh(markerGeometry, startMarkerMaterial)
    startMarker.position.copy(startPoint)
    scene.add(startMarker)
    const endMarker = new THREE.Mesh(markerGeometry, endMarkerMaterial)
    endMarker.position.copy(endPoint)
    scene.add(endMarker)
    disposers.push(() => {
      markerGeometry.dispose()
      startMarkerMaterial.dispose()
      endMarkerMaterial.dispose()
    })
    const pointGeometry = new THREE.SphereGeometry(Math.max(bounds.span * 0.0055, 2.2), 14, 14)
    const hoverPointMaterial = new THREE.MeshStandardMaterial({
      color: '#6ea4e8',
      emissive: '#1b6ed6',
      emissiveIntensity: 0.45,
      metalness: 0.08,
      roughness: 0.45,
    })
    const pointScale = 1.78
    const pointOffsetZ = Math.max(bounds.span * 0.0008, 0.2)
    const hoverMesh = new THREE.Mesh(pointGeometry, hoverPointMaterial)
    hoverMesh.visible = false
    hoverMesh.scale.setScalar(pointScale)
    scene.add(hoverMesh)
    const pickCandidates = buildPickCandidates(visits, pointOffsetZ)
    const dragCandidates = buildDragCandidates(visits, pointOffsetZ)
    disposers.push(() => {
      pointGeometry.dispose()
      hoverPointMaterial.dispose()
    })

    sceneStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      disposers,
      pathLine,
      pathGeometry,
      startMarker,
      endMarker,
      hoverMesh,
      pickCandidatesRef: { current: pickCandidates },
      dragCandidatesRef: { current: dragCandidates },
      activeTrajectoryColorRef: { current: activeTrajectoryColor },
      pointOffsetZ,
      isFirstMount: sceneStateRef.current === null,
    }

    if (sceneStateRef.current.isFirstMount) {
      console.log('[TrajectoryScene3D] First mount - initializing camera')
    } else {
      console.log('[TrajectoryScene3D] Re-render - preserving camera position')
    }

    let hoveredCandidate: PickCandidate | null = null
    let draggingCandidate: DragCandidate | null = null
    let hasDragDelta = false
    let activePointerId: number | null = null
    let pointerDown = { x: 0, y: 0 }
    let pointerMoved = false
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const dragPlaneHit = new THREE.Vector3()
    const pickCandidateAtPointer = (event: PointerEvent) =>
      pickNearestAtPointer(event, sceneStateRef.current!.pickCandidatesRef.current, camera, renderer.domElement)
    const pickDragCandidateAtPointer = (event: PointerEvent) =>
      pickNearestAtPointer(event, sceneStateRef.current!.dragCandidatesRef.current, camera, renderer.domElement)
    const setHoveredCandidate = (candidate: PickCandidate | null) => {
      hoveredCandidate = candidate
      if (!candidate) {
        hoverMesh.visible = false
        renderer.domElement.style.cursor = 'default'
        return
      }
      hoverMesh.visible = true
      hoverMesh.position.copy(candidate.position)
      const draggable = sceneStateRef.current!.dragCandidatesRef.current.some((item) => item.blockId === candidate.blockId)
      renderer.domElement.style.cursor = draggable ? 'grab' : 'pointer'
    }
    const resetHovered = () => {
      if (draggingCandidate) {
        return
      }
      setHoveredCandidate(null)
      renderer.domElement.style.cursor = 'default'
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }
      pointerDown = { x: event.clientX, y: event.clientY }
      pointerMoved = false
      hasDragDelta = false
      if (!onMovePoint) {
        return
      }
      const hit = pickDragCandidateAtPointer(event)
      if (!hit) {
        return
      }
      draggingCandidate = {
        ...hit,
        position: hit.position.clone(),
      }
      controls.enabled = false
      renderer.domElement.style.cursor = 'grabbing'
      activePointerId = event.pointerId
      renderer.domElement.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (draggingCandidate && onMovePoint) {
        const next = projectPointerToPlane(
          event,
          renderer.domElement,
          camera,
          raycaster,
          pointer,
          dragPlane,
          dragPlaneHit,
          draggingCandidate.position.z,
        )
        if (next) {
          const x = snapToStep(Math.min(Math.max(next.x, bounds.minX), bounds.maxX), SNAP_STEP)
          const y = snapToStep(Math.min(Math.max(next.y, bounds.minY), bounds.maxY), SNAP_STEP)
          if (x !== draggingCandidate.x || y !== draggingCandidate.y) {
            hasDragDelta = true
            draggingCandidate.x = x
            draggingCandidate.y = y
            draggingCandidate.position.x = x
            draggingCandidate.position.y = y
            hoverMesh.visible = true
            hoverMesh.position.copy(draggingCandidate.position)
          }
        }
        return
      }
      if (!pointerMoved) {
        const dx = event.clientX - pointerDown.x
        const dy = event.clientY - pointerDown.y
        if (Math.hypot(dx, dy) > 4) {
          pointerMoved = true
        }
      }
      const nextCandidate = pickDragCandidateAtPointer(event) ?? pickCandidateAtPointer(event)
      if (nextCandidate?.blockId === hoveredCandidate?.blockId) {
        return
      }
      setHoveredCandidate(nextCandidate)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }
      if (draggingCandidate) {
        const blockId = draggingCandidate.blockId
        if (hasDragDelta) {
          onMovePoint?.({
            blockId,
            blockType: draggingCandidate.blockType,
            x: draggingCandidate.x,
            y: draggingCandidate.y,
            baseX: draggingCandidate.baseX,
            baseY: draggingCandidate.baseY,
          })
        } else {
          onLocateBlock?.(blockId)
        }
        controls.enabled = true
        if (activePointerId !== null && renderer.domElement.hasPointerCapture(activePointerId)) {
          renderer.domElement.releasePointerCapture(activePointerId)
        }
        activePointerId = null
        draggingCandidate = null
        const nextCandidate = pickDragCandidateAtPointer(event) ?? pickCandidateAtPointer(event)
        setHoveredCandidate(nextCandidate)
        return
      }
      if (pointerMoved) {
        return
      }
      const hit = pickCandidateAtPointer(event)
      const blockId = hit?.blockId
      if (blockId) {
        onLocateBlock?.(blockId)
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', resetHovered)
    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()
    let animationFrameId = 0
    const render = () => {
      controls.update()
      renderer.render(scene, camera)
      animationFrameId = window.requestAnimationFrame(render)
    }
    render()
    return () => {
      console.log('[TrajectoryScene3D] CLEANUP - component unmounting')
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', resetHovered)
      if (activePointerId !== null && renderer.domElement.hasPointerCapture(activePointerId)) {
        renderer.domElement.releasePointerCapture(activePointerId)
      }
      renderer.domElement.style.cursor = 'default'
      disposers.forEach((dispose) => dispose())
      renderer.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [
    bounds.maxX,
    bounds.maxY,
    bounds.maxZ,
    bounds.minX,
    bounds.minY,
    bounds.minZ,
    bounds.span,
    center.x,
    center.y,
    center.z,
    onLocateBlock,
    onMovePoint,
    backgroundTrajectories,
    activeTrajectoryColor,
    rodConfig,
  ])

  useEffect(() => {
    const state = sceneStateRef.current
    console.log('[TrajectoryScene3D] visitsEffect RUN, state:', !!state, 'visits:', visits.length)
    if (!state || !visits.length || !state.pathGeometry || !state.startMarker || !state.endMarker) {
      console.log('[TrajectoryScene3D] visitsEffect SKIP')
      return
    }
    console.log('[TrajectoryScene3D] visits effect triggered, visits.length:', visits.length, 'bounds.span:', bounds.span)
    const pathPoints = visits.map((visit) => new THREE.Vector3(visit.x, visit.y, visit.z))
    state.pathGeometry.setFromPoints(pathPoints)
    const startPoint = pathPoints[0]
    const endPoint = pathPoints[pathPoints.length - 1]
    state.startMarker.position.copy(startPoint)
    state.endMarker.position.copy(endPoint)
    const newPointOffsetZ = Math.max(bounds.span * 0.0008, 0.2)
    state.pickCandidatesRef.current = buildPickCandidates(visits, newPointOffsetZ)
    state.dragCandidatesRef.current = buildDragCandidates(visits, newPointOffsetZ)
    state.pointOffsetZ = newPointOffsetZ
  }, [visits, bounds.span])

  if (!visits.length) {
    return <Empty description="暂无可绘制轨迹" />
  }
  return (
    <div className="trajectory-3d-stage">
      <div ref={containerRef} className="trajectory-3d-canvas" />
      <div className="trajectory-3d-tip">拖拽空白处旋转 · 滚轮缩放 · 拖动高亮点可改坐标 · 点击点可定位积木</div>
    </div>
  )
}
export default TrajectoryScene3D
