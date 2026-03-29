import { Empty } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { TrajectoryBounds, Visit } from './trajectory/trajectoryUtils'
import { GRID_STEP } from './trajectory/trajectoryUtils'

type Props = {
  visits: Visit[]
  bounds: TrajectoryBounds
}

const createGridLine = (
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

function TrajectoryScene3D({ visits, bounds }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const center = useMemo(
    () => ({
      x: bounds.minX + bounds.span / 2,
      y: bounds.minY + bounds.span / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    }),
    [bounds.maxZ, bounds.minX, bounds.minY, bounds.minZ, bounds.span],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !visits.length) {
      return
    }

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

    const pathPoints = visits.map((visit) => new THREE.Vector3(visit.x, visit.y, visit.z))
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints)
    const pathMaterial = new THREE.LineBasicMaterial({ color: '#1b6ed6' })
    const pathLine = new THREE.Line(pathGeometry, pathMaterial)
    scene.add(pathLine)
    disposers.push(() => {
      pathGeometry.dispose()
      pathMaterial.dispose()
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
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      controls.dispose()
      disposers.forEach((dispose) => dispose())
      renderer.dispose()
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [bounds.maxX, bounds.maxY, bounds.maxZ, bounds.minX, bounds.minY, bounds.minZ, bounds.span, center.x, center.y, center.z, visits])

  if (!visits.length) {
    return <Empty description="暂无可绘制轨迹" />
  }

  return (
    <div className="trajectory-3d-stage">
      <div ref={containerRef} className="trajectory-3d-canvas" />
      <div className="trajectory-3d-tip">拖拽旋转 · 滚轮缩放 · 右键平移</div>
    </div>
  )
}

export default TrajectoryScene3D
