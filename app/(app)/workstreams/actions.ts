"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authedAction, canEditProducts } from "@/lib/actions/utils";

const uuidSchema = z.string().uuid();

const faqSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().max(10000),
});

export interface FaqInput {
  question: string;
  answer: string;
}

/**
 * Authorize managing a workstream's FAQs: a global admin, or a member of an
 * owning team who can edit workstreams. Mirrors can_manage_workstream() in
 * migration 0033 — RLS is the real boundary; this gives a clear error message
 * instead of a silent no-op.
 */
async function assertCanManage(
  productId: string,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<void> {
  const { supabase, profile } = ctx;
  if (profile.role === "admin") return;
  if (!canEditProducts(profile) || !profile.team_id) {
    throw new Error("You aren't allowed to edit this workstream.");
  }
  const { data: owns } = await supabase
    .from("product_owners")
    .select("team_id")
    .eq("product_id", productId)
    .eq("team_id", profile.team_id)
    .maybeSingle();
  if (!owns) {
    throw new Error("Your team doesn't own this workstream.");
  }
}

/** The product a FAQ belongs to (also proves it exists). */
async function productOfFaq(
  faqId: string,
  ctx: Awaited<ReturnType<typeof authedAction>>
): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("workstream_faqs")
    .select("product_id")
    .eq("id", faqId)
    .maybeSingle<{ product_id: string }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("FAQ not found");
  return data.product_id;
}

function revalidateWorkstream(productId: string) {
  revalidatePath(`/workstreams/${productId}`);
  revalidatePath("/workstreams");
}

export async function createFaq(
  productId: string,
  input: FaqInput
): Promise<{ ok: true }> {
  const pid = uuidSchema.parse(productId);
  const parsed = faqSchema.parse(input);
  const ctx = await authedAction();
  await assertCanManage(pid, ctx);

  // Append to the end of the list.
  const { data: last } = await ctx.supabase
    .from("workstream_faqs")
    .select("display_order")
    .eq("product_id", pid)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();

  const { error } = await ctx.supabase.from("workstream_faqs").insert({
    product_id: pid,
    question: parsed.question,
    answer: parsed.answer,
    display_order: (last?.display_order ?? -1) + 1,
    created_by: ctx.profile.id,
  });
  if (error) throw new Error(error.message);

  revalidateWorkstream(pid);
  return { ok: true };
}

export async function updateFaq(
  faqId: string,
  input: FaqInput
): Promise<{ ok: true }> {
  const id = uuidSchema.parse(faqId);
  const parsed = faqSchema.parse(input);
  const ctx = await authedAction();
  const productId = await productOfFaq(id, ctx);
  await assertCanManage(productId, ctx);

  const { error } = await ctx.supabase
    .from("workstream_faqs")
    .update({
      question: parsed.question,
      answer: parsed.answer,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateWorkstream(productId);
  return { ok: true };
}

export async function deleteFaq(faqId: string): Promise<{ ok: true }> {
  const id = uuidSchema.parse(faqId);
  const ctx = await authedAction();
  const productId = await productOfFaq(id, ctx);
  await assertCanManage(productId, ctx);

  const { error } = await ctx.supabase
    .from("workstream_faqs")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateWorkstream(productId);
  return { ok: true };
}

/** Swap a FAQ with its neighbour, then renumber the list densely. */
export async function moveFaq(
  faqId: string,
  direction: "up" | "down"
): Promise<{ ok: true }> {
  const id = uuidSchema.parse(faqId);
  if (direction !== "up" && direction !== "down") {
    throw new Error("Invalid direction");
  }
  const ctx = await authedAction();
  const productId = await productOfFaq(id, ctx);
  await assertCanManage(productId, ctx);

  const { data: rows, error: listErr } = await ctx.supabase
    .from("workstream_faqs")
    .select("id, display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .returns<{ id: string; display_order: number }[]>();
  if (listErr) throw new Error(listErr.message);

  const list = rows ?? [];
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("FAQ not found");
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) return { ok: true }; // at an end

  const reordered = [...list];
  [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];

  // Write only the rows whose position actually changed, in parallel.
  const writes = reordered
    .map((r, i) => ({ id: r.id, order: i }))
    .filter(({ id: rid, order }) => {
      const before = list.find((r) => r.id === rid);
      return before?.display_order !== order;
    });
  const results = await Promise.all(
    writes.map((w) =>
      ctx.supabase
        .from("workstream_faqs")
        .update({ display_order: w.order })
        .eq("id", w.id)
    )
  );
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
  }

  revalidateWorkstream(productId);
  return { ok: true };
}
