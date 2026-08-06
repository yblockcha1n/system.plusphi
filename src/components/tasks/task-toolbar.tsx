"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import type { ProjectOption } from "@/features/projects/schema";
import type { UserOption } from "@/lib/env";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { Button } from "@/components/ui/button";

type TaskToolbarProps = {
  projects: ProjectOption[];
  users: UserOption[];
  defaultProjectId?: string | null;
  label?: string;
};

export function TaskToolbar({
  projects,
  users,
  defaultProjectId,
  label = "タスクを登録",
}: TaskToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        {label}
      </Button>
      <TaskSheet
        open={open}
        onOpenChange={setOpen}
        defaultProjectId={defaultProjectId}
        projects={projects}
        users={users}
      />
    </>
  );
}
