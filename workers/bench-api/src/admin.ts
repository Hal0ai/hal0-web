import { checkAdmin } from "./auth";
import { type Env, errors, json } from "./router";

export async function deleteHandler(req: Request, env: Env, params: Record<string, string>): Promise<Response> {
  if (!(await checkAdmin(req, env))) return errors(["unauthorized"], 401);

  const id = params.id;

  // Verify bundle exists
  const bundle = await env.DB.prepare("SELECT id FROM bundles WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();

  if (!bundle) return errors(["bundle not found"], 404);

  // Soft delete: set status='deleted' on bundle + cascading records/profiles/evals
  const statements = [
    env.DB.prepare("UPDATE bundles SET status = 'deleted' WHERE id = ?").bind(id),
    env.DB.prepare("UPDATE records SET status = 'deleted' WHERE bundle_id = ?").bind(id),
    env.DB.prepare("UPDATE profiles SET status = 'deleted' WHERE bundle_id = ?").bind(id),
    env.DB.prepare("UPDATE evals SET status = 'deleted' WHERE bundle_id = ?").bind(id),
  ];

  try {
    await env.DB.batch(statements);
  } catch (e) {
    console.error("deleteHandler: batch failed", e);
    return errors(["delete failed"], 500);
  }

  return json({ deleted: id });
}
