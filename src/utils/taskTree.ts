import { ProjectTask } from '../types';

/**
 * Traverses the task tree to find a specific task by ID and updates it, 
 * returning the new task list.
 */
export const updateTaskInTree = (
  tasks: ProjectTask[],
  id: string,
  updater: (task: ProjectTask) => Partial<ProjectTask>
): ProjectTask[] => {
  return tasks.map(task => {
    if (task.id === id) {
      const partial = updater(task);
      const updated = { ...task, ...partial };
      
      // If we are updating progress, recalculate completion automatically.
      // Rule: a task only counts as done when progress is 100% AND a work result was reported.
      // Skipped when the patch explicitly sets isCompleted — the cascade branch below owns that case
      // (otherwise the 70/30 formula would override an explicit completion, then reset progress to 0).
      if (!('isCompleted' in partial) && ('staffProgress' in partial || 'managerProgress' in partial)) {
        const sp = partial.staffProgress !== undefined ? partial.staffProgress : (task.staffProgress ?? 0);
        const mp = partial.managerProgress !== undefined ? partial.managerProgress : (task.managerProgress ?? 0);
        const totalProgress = (sp * 0.7) + (mp * 0.3);
        const hasResult = !!(updated.ketQuaCongViec || '').trim();
        const allDone = totalProgress >= 100 && hasResult;
        updated.isCompleted = allDone;
        updated.completedAt = allDone ? new Date().toISOString().split('T')[0] : undefined;
      }
      
      // If we are completing/uncompleting a task, optionally cascade down to all descendants
      if ('isCompleted' in partial) {
        const cascadeCompletion = (subList?: ProjectTask[], completed?: boolean): ProjectTask[] | undefined => {
          if (!subList) return undefined;
          return subList.map(st => ({
            ...st,
            isCompleted: completed ?? false,
            completedAt: completed ? new Date().toISOString().split('T')[0] : undefined,
            staffProgress: completed ? 100 : 0,
            managerProgress: completed ? 100 : 0,
            subtasks: cascadeCompletion(st.subtasks, completed)
          }));
        };
        updated.subtasks = cascadeCompletion(updated.subtasks, updated.isCompleted);
        if (updated.isCompleted) {
          updated.staffProgress = 100;
          updated.managerProgress = 100;
        } else {
          updated.staffProgress = 0;
          updated.managerProgress = 0;
        }
      }
      return updated;
    } else if (task.subtasks && task.subtasks.length > 0) {
      const nextSubtasks = updateTaskInTree(task.subtasks, id, updater);
      
      // Auto-recalculate parent status based on updated subtasks
      const allCompleted = nextSubtasks.every(st => st.isCompleted);
      return {
        ...task,
        subtasks: nextSubtasks,
        isCompleted: allCompleted,
        completedAt: allCompleted ? new Date().toISOString().split('T')[0] : undefined
      };
    }
    return task;
  });
};

/**
 * Adds a new subtask nested inside a parent task in the tree.
 */
export const addSubtaskToTree = (
  tasks: ProjectTask[],
  parentId: string,
  newSubtask: ProjectTask
): ProjectTask[] => {
  return tasks.map(task => {
    if (task.id === parentId) {
      const existingSubtasks = task.subtasks || [];
      return {
        ...task,
        isCompleted: false, // Adding a new uncompleted task means parent is no longer complete
        completedAt: undefined,
        subtasks: [...existingSubtasks, newSubtask]
      };
    } else if (task.subtasks && task.subtasks.length > 0) {
      const updatedSubtasks = addSubtaskToTree(task.subtasks, parentId, newSubtask);
      const allCompleted = updatedSubtasks.every(st => st.isCompleted);
      return {
        ...task,
        subtasks: updatedSubtasks,
        isCompleted: allCompleted,
        completedAt: allCompleted ? new Date().toISOString().split('T')[0] : undefined
      };
    }
    return task;
  });
};

/**
 * Deletes a task from the tree at any nesting level.
 */
export const removeTaskFromTree = (tasks: ProjectTask[], id: string): ProjectTask[] => {
  return tasks
    .filter(task => task.id !== id)
    .map(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        const nextSubtasks = removeTaskFromTree(task.subtasks, id);
        const allCompleted = nextSubtasks.length > 0 ? nextSubtasks.every(st => st.isCompleted) : task.isCompleted;
        return {
          ...task,
          subtasks: nextSubtasks,
          isCompleted: allCompleted,
          completedAt: allCompleted ? new Date().toISOString().split('T')[0] : undefined
        };
      }
      return task;
    });
};

/**
 * Recursively calculates the overall completion progress of a task based on its children.
 * Returns a value between 0 and 100.
 */
export const getTaskProgress = (task: ProjectTask): number => {
  if (!task.subtasks || task.subtasks.length === 0) {
    if (task.staffProgress !== undefined || task.managerProgress !== undefined) {
      const sp = task.staffProgress ?? 0;
      const mp = task.managerProgress ?? 0;
      return Math.round((sp * 0.7) + (mp * 0.3));
    }
    return task.isCompleted ? 100 : 0;
  }
  
  // If children have custom weights, do weighted progress, otherwise equal weight
  const hasWeights = task.subtasks.some(st => (st.weight || 0) > 0);
  if (hasWeights) {
    const totalWeight = task.subtasks.reduce((sum, st) => sum + (st.weight || 0), 0);
    if (totalWeight > 0) {
      const completedWeight = task.subtasks.reduce(
        (sum, st) => sum + (getTaskProgress(st) / 100) * (st.weight || 0),
        0
      );
      return Math.round((completedWeight / totalWeight) * 100);
    }
  }
  
  // Equal distribution progress
  const subtaskProgressSum = task.subtasks.reduce((sum, st) => sum + getTaskProgress(st), 0);
  return Math.round(subtaskProgressSum / task.subtasks.length);
};

/**
 * Calculates the overall project team progress based on top-level tasks.
 */
export const calculateProjectProgress = (tasks: ProjectTask[]): number => {
  if (!tasks || tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) {
    const progressSum = tasks.reduce((sum, t) => sum + getTaskProgress(t), 0);
    return Math.round(progressSum / tasks.length);
  }
  
  const completedWeight = tasks.reduce(
    (sum, t) => sum + (getTaskProgress(t) / 100) * t.weight,
    0
  );
  return Math.round((completedWeight / totalWeight) * 100);
};

/**
 * Recursively gathers all tasks that are assigned to a specific user ID,
 * or where they are the executor (fallback if unassigned).
 */
export const getAssignedTasksFromList = (
  tasks: ProjectTask[],
  userId: string,
  isDefaultProjectExecutor: boolean
): { task: ProjectTask; depth: number }[] => {
  const result: { task: ProjectTask; depth: number }[] = [];
  
  const traverse = (tList: ProjectTask[], currentDepth: number) => {
    tList.forEach(t => {
      const isAssigned = t.assignedTo ? (t.assignedTo === userId) : isDefaultProjectExecutor;
      if (isAssigned) {
        result.push({ task: t, depth: currentDepth });
      }
      if (t.subtasks && t.subtasks.length > 0) {
        traverse(t.subtasks, currentDepth + 1);
      }
    });
  };
  
  traverse(tasks, 0);
  return result;
};
