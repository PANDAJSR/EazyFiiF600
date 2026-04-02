import { useCallback, useMemo, useState } from 'react'
import type { DroneProgram } from '../types/fii'

const TRAJECTORY_COLORS = ['#1b6ed6', '#2f9e44', '#e67700', '#8e44ad', '#e03131', '#0ca678', '#364fc7', '#c2255c']

export const getTrajectoryColor = (index: number) => TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length]

export type TrajectoryDisplay = {
  droneId: string
  color: string
  startPos: DroneProgram['drone']['startPos']
  blocks: DroneProgram['blocks']
}

function useTrajectoryVisibility(programs: DroneProgram[]) {
  const [hiddenTrajectoryIds, setHiddenTrajectoryIds] = useState<string[]>([])
  const visibleTrajectoryIds = useMemo(() => {
    const hiddenSet = new Set(hiddenTrajectoryIds)
    return programs.map((program) => program.drone.id).filter((id) => !hiddenSet.has(id))
  }, [hiddenTrajectoryIds, programs])

  const toggleTrajectoryVisibility = useCallback((droneId: string, visible: boolean) => {
    setHiddenTrajectoryIds((prev) => {
      if (visible) {
        return prev.filter((id) => id !== droneId)
      }
      return prev.includes(droneId) ? prev : [...prev, droneId]
    })
  }, [])

  const backgroundTrajectories = useMemo<TrajectoryDisplay[]>(() => {
    const visibleSet = new Set(visibleTrajectoryIds)
    return programs
      .map((program, index) => ({
        droneId: program.drone.id,
        color: getTrajectoryColor(index),
        startPos: program.drone.startPos,
        blocks: program.blocks,
      }))
      .filter((program) => visibleSet.has(program.droneId))
  }, [programs, visibleTrajectoryIds])

  return {
    visibleTrajectoryIds,
    toggleTrajectoryVisibility,
    backgroundTrajectories,
  }
}

export default useTrajectoryVisibility
