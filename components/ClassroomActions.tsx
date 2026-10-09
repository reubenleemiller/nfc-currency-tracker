"use client";

import { deleteClassroom, setArchived } from "@/app/actions";

export function ClassroomActions({ classroomId, classroomName, archived }: { classroomId: string; classroomName: string; archived: boolean }) {
  return <div className="flex flex-wrap gap-2">
    <form action={setArchived}><input type="hidden" name="classroomId" value={classroomId} /><input type="hidden" name="archived" value={String(!archived)} /><button className="btn btn-soft">{archived ? "Restore class" : "Archive class"}</button></form>
    <form action={deleteClassroom} onSubmit={(event) => {
      if (!window.confirm(`Delete ${classroomName}? This permanently removes its students and transaction history. Your shared account store will remain. This cannot be undone.`)) event.preventDefault();
    }}><input type="hidden" name="classroomId" value={classroomId} /><button className="btn bg-red-700">Delete</button></form>
  </div>;
}
