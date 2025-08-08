// Utility wrappers around @vercel/blob in case we need to centralize token usage
// and provide helpers for future features.
import { put, del, copy, head, list, type PutBlobResult } from "@vercel/blob";

export { put, del, copy, head, list };
export type { PutBlobResult };

// No custom logic yet; the PostService uses put()/del() directly. This module
// is a placeholder to standardize imports and make it easy to evolve.
