import { createDraft } from "@/app/(app)/requests/actions";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  // Creates a draft and redirects to /requests/[id]/edit.
  await createDraft();
  // createDraft() always redirects, so this line is unreachable. It satisfies
  // the return-type checker.
  return null;
}
