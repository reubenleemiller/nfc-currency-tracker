"use client";

import { deleteClassroom } from "@/app/actions";

export function DeleteClassroomButton({ classroomId, classroomName }: { classroomId: string; classroomName: string }) {
  return <form action={deleteClassroom} onSubmit={(event) => {
    if (!window.confirm(`Delete ${classroomName}? This permanently removes its students and transaction history. Your shared account store will remain. This cannot be undone.`)) event.preventDefault();
  }}>
    <input type="hidden" name="classroomId" value={classroomId} />
    <button className="btn bg-red-700">Delete class</button>
  </form>;
}
