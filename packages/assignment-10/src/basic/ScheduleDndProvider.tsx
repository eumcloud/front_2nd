import {
  DndContext,
  Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import React, { PropsWithChildren, useCallback, useMemo } from "react";
import { CellSize, DAY_LABELS } from "./constants.ts";
import { useScheduleContext } from "./ScheduleContext.tsx";

function createSnapModifier(): Modifier {
  return ({ transform, containerNodeRect, draggingNodeRect }) => {
    const containerTop = containerNodeRect?.top ?? 0;
    const containerLeft = containerNodeRect?.left ?? 0;
    const containerBottom = containerNodeRect?.bottom ?? 0;
    const containerRight = containerNodeRect?.right ?? 0;

    const { top = 0, left = 0, bottom = 0, right = 0 } = draggingNodeRect ?? {};

    const minX = containerLeft - left + 120 + 1;
    const minY = containerTop - top + 40 + 1;
    const maxX = containerRight - right;
    const maxY = containerBottom - bottom;

    return {
      ...transform,
      x: Math.min(
        Math.max(
          Math.round(transform.x / CellSize.WIDTH) * CellSize.WIDTH,
          minX
        ),
        maxX
      ),
      y: Math.min(
        Math.max(
          Math.round(transform.y / CellSize.HEIGHT) * CellSize.HEIGHT,
          minY
        ),
        maxY
      ),
    };
  };
}

const modifiers = [createSnapModifier()];
const ScheduleDndProvider: React.FC<React.PropsWithChildren> = React.memo(
  ({ children }) => {
    const { schedulesMap, setSchedulesMap } = useScheduleContext();
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8,
        },
      })
    );

    const handleDragEnd = useCallback(
      (event: any) => {
        const { active, delta } = event;
        const { x, y } = delta;
        const [tableId, index] = active.id.split(":");
        const schedule = schedulesMap[tableId][index];
        const nowDayIndex = DAY_LABELS.indexOf(
          schedule.day as (typeof DAY_LABELS)[number]
        );
        const moveDayIndex = Math.floor(x / 80);
        const moveTimeIndex = Math.floor(y / 30);

        setSchedulesMap((prevSchedulesMap) => {
          const updatedSchedules = [...prevSchedulesMap[tableId]];
          updatedSchedules[Number(index)] = {
            ...schedule,
            day: DAY_LABELS[nowDayIndex + moveDayIndex],
            range: schedule.range.map((time) => time + moveTimeIndex),
          };
          return {
            ...prevSchedulesMap,
            [tableId]: updatedSchedules,
          };
        });
      },
      [schedulesMap, setSchedulesMap]
    );

    const memoizedModifiers = useMemo(() => modifiers, []);

    return (
      <DndContext
        sensors={sensors}
        onDragEnd={handleDragEnd}
        modifiers={memoizedModifiers}
      >
        {children}
      </DndContext>
    );
  }
);

export default ScheduleDndProvider;
