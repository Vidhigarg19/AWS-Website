// ============================================================
// The real image processor, shaped for the completion ports (server only)
// ============================================================

import { UnreadableImage, type CompletionPorts } from "./complete";
import { processImage, UnreadableImageError } from "./process-image";

export const imagePort: Pick<CompletionPorts, "processImage"> = {
  async processImage(original) {
    try {
      return await processImage(original);
    } catch (err) {
      // A file that cannot be decoded is the uploader's problem (reject it);
      // anything else is ours (leave the row retryable).
      if (err instanceof UnreadableImageError) throw new UnreadableImage(err.message);
      throw err;
    }
  },
};
